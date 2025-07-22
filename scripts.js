document.addEventListener('DOMContentLoaded', function() {
    const tooltip = document.createElement('div');
    tooltip.id = 'audio-tooltip';
    document.body.appendChild(tooltip);

    const botonesAudio = document.querySelectorAll('.selector');
    const contextoAudio = new (window.AudioContext || window.webkitAudioContext)();
    const masterGainNode = contextoAudio.createGain();
    masterGainNode.connect(contextoAudio.destination);
    
    const visualizador = document.querySelector('.visualizador');

    const fuentesAudio = {};
    const volumenesOriginales = {};
    let consolaEncendida = false;
    let enPausa = false;

    // Objeto para almacenar la información de los audios del CSV
    const audioMetadata = {};

    // --- INICIO: Carga y parseo del CSV ---
    // Función para parsear CSV
    async function parseCSV(url) {
        const response = await fetch(url);
        const text = await response.text();
        const lines = text.split('\n');
        // Los encabezados están en la segunda línea (índice 1)
        const headers = lines[1].split(',').map(header => header.trim()); 
        // Los datos comienzan desde la tercera línea (índice 2)
        const dataLines = lines.slice(2); 

        dataLines.forEach(line => {
            const values = parseCSVLine(line);
            if (values.length > 1) { // Asegurarse de que la línea no esté vacía
                const fileName = values[0]; // Columna 1
                const title = values[1];    // Columna 2
                const region = values[3];   // Columna 4
                const department = values[4]; // Columna 5: Departamento
                if (fileName && title && region && department) {
                    // Normalizar el nombre del archivo a NFC para asegurar la consistencia
                    audioMetadata[fileName.trim().normalize('NFC')] = {
                        title: title.trim(),
                        region: region.trim(),
                        department: department.trim() // Guardar el departamento
                    };
                }
            }
        });
    }

    // Función auxiliar para parsear líneas CSV que pueden contener comas dentro de comillas
    function parseCSVLine(line) {
        const result = [];
        let inQuote = false;
        let currentField = '';
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
                result.push(currentField);
                currentField = '';
            } else {
                currentField += char;
            }
        }
        result.push(currentField); // Añadir el último campo
        return result;
    }

    // Cargar los metadatos del CSV al inicio
    // IMPORTANTE: Asegúrate de que "Consola.csv" sea un archivo CSV real, no un XLSX renombrado.
    // Debes guardar tu archivo XLSX como CSV desde tu programa de hojas de cálculo.
    parseCSV('Consola.csv').then(() => {
        console.log('Metadatos de audio cargados:', audioMetadata);
        // Una vez que los metadatos están cargados, inicializar los botones de audio
        inicializarBotonesAudio();
        // Actualizar visualizador después de cargar metadatos
        actualizarVisualizador(); 
    }).catch(error => {
        console.error('Error al cargar o parsear el CSV:', error);
    });
    // --- FIN: Carga y parseo del CSV ---

    // --- INICIO: Inicialización de componentes ---
    // Inicializar deslizadores circulares
    new DeslizadorCircular(document.getElementById('volumen'), { value: 50, id: 'volumen' });

    // Inicializar deslizadores verticales
    document.querySelectorAll('.deslizador-vertical-js').forEach(container => {
        const id = container.id;
        new DeslizadorVertical(container, { id: id, value: 50 });
        volumenesOriginales[id] = 0.5; // Guardar valor inicial
    });
    // --- FIN: Inicialización de componentes ---

    function actualizarVisualizador() {
        while (visualizador.firstChild) {
            visualizador.removeChild(visualizador.firstChild);
        }

        const audiosSeleccionados = document.querySelectorAll('.selector.active');
        
        if (audiosSeleccionados.length === 0) {
            const placeholder = document.createElement('div');
            placeholder.className = 'visualizador-placeholder';
            
            const img = document.createElement('img');
            img.src = 'Imagenes/etno-dj.png';
            img.alt = 'Visualizador EtnoDJ';
            img.style.maxWidth = '80%';
            img.style.maxHeight = '80%';
            img.style.borderRadius = '12px';
            img.style.margin = 'auto';
            img.style.opacity = '0.5';
            placeholder.appendChild(img);
            visualizador.appendChild(placeholder);
            return;
        }

        const categorias = ['armonia', 'melodia', 'ritmo', 'fondo', 'adornos'];
        audiosSeleccionados.forEach(boton => {
            // Normalizar el nombre del archivo a NFC para asegurar la consistencia
            const audioFileName = boton.getAttribute('data-audio').split('/').pop().normalize('NFC');
            const metadata = audioMetadata[audioFileName];
            let displayText = '';

            if (metadata) {
                // Formato: Título - Región - Departamento: Departamento
                displayText = `${metadata.title} - ${metadata.region} - Departamento: ${metadata.department}`;
            } else {
                // Fallback si no se encuentra en los metadatos
                const nombreArchivoSinExtension = audioFileName.replace(/\.[^/.]+$/, "").replace(/_/g, ' ');
                displayText = nombreArchivoSinExtension.charAt(0).toUpperCase() + nombreArchivoSinExtension.slice(1);
            }

            const itemAudio = document.createElement('div');
            itemAudio.className = 'visualizador-item';
            itemAudio.textContent = displayText;
            
            let categoriaEncontrada = '';
            for (const cat of categorias) {
                if (boton.classList.contains(cat)) {
                    categoriaEncontrada = cat;
                    break;
                }
            }
            if (categoriaEncontrada) {
                itemAudio.classList.add(categoriaEncontrada);
            }

            visualizador.appendChild(itemAudio);
        });
    }

    function cargarAudio(url) {
        if (!url) return Promise.resolve(null);
        return fetch(url)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.arrayBuffer();
            })
            .then(buffer => contextoAudio.decodeAudioData(buffer))
            .catch(e => console.error(`Error al cargar audio: ${url}`, e));
    }

    function reproducirAudio(audioBuffer) {
        const source = contextoAudio.createBufferSource();
        source.buffer = audioBuffer;
        source.loop = true;
        const gainNode = contextoAudio.createGain();
        source.connect(gainNode).connect(masterGainNode);
        source.start();
        return { source, gainNode };
    }

    function seccionDebeSonar(sectionId) {
        const muteBtn = document.getElementById(`mute-${sectionId}`);
        const soloBtn = document.getElementById(`solo-${sectionId}`);
        const haySoloActivo = Array.from(document.querySelectorAll('.solo')).some(b => b.classList.contains('activo'));
        const estaEnSolo = soloBtn && soloBtn.classList.contains('activo');
        const estaMuteada = muteBtn && muteBtn.classList.contains('activo');
        if (estaMuteada) return false;
        if (haySoloActivo) return estaEnSolo;
        return true;
    }

    function actualizarBotonesDeAudios() {
        botonesAudio.forEach(button => {
            const section = button.dataset.section;
            if (!section) return;
            const seccionId = section.replace('volumen-', '');
            const debeSonar = seccionDebeSonar(seccionId);
            button.classList.toggle('sonando', button.classList.contains('active') && debeSonar && !enPausa);
        });
    }

    // Función para inicializar los botones de audio después de que los metadatos estén cargados
    function inicializarBotonesAudio() {
        botonesAudio.forEach((button) => {
            button.dataset.active = 'false';
            const audioUrl = button.getAttribute('data-audio');
            const sectionId = button.closest('.fila').dataset.section;
            button.setAttribute('data-section', sectionId);
            
            if (audioUrl) {
                // Normalizar el nombre del archivo a NFC para asegurar la consistencia
                const audioFileName = audioUrl.split('/').pop().normalize('NFC');
                const metadata = audioMetadata[audioFileName];
                let tooltipText = '';

                if (metadata) {
                    // Solo el título para el tooltip
                    tooltipText = metadata.title;
                } else {
                    // Fallback si no se encuentra en los metadatos
                    const nombreArchivoSinExtension = audioFileName.replace(/\.[^/.]+$/, "").replace(/_/g, ' '); 
                    tooltipText = nombreArchivoSinExtension.charAt(0).toUpperCase() + nombreArchivoSinExtension.slice(1);
                }
                button.setAttribute('data-tooltip', tooltipText);
            }

            button.addEventListener('mouseenter', () => {
                if (!consolaEncendida) return;
                const tooltipText = button.getAttribute('data-tooltip');
                if (tooltipText) {
                    tooltip.textContent = tooltipText;
                    tooltip.classList.add('visible');
                    const btnRect = button.getBoundingClientRect();
                    const left = btnRect.left + (btnRect.width / 2);
                    const top = btnRect.top + (btnRect.height / 2);
                    tooltip.style.left = `${left}px`;
                    tooltip.style.top = `${top}px`;
                }
            });

            button.addEventListener('mouseleave', () => {
                tooltip.classList.remove('visible');
            });

            cargarAudio(audioUrl).then(audioBuffer => {
                if (!audioBuffer) return;
                fuentesAudio[button.id] = { buffer: audioBuffer, source: null, gainNode: null };

                button.addEventListener('click', function() {
                    if (!consolaEncendida) return;
                    this.classList.toggle('active');
                    actualizarVisualizador();
                    
                    const isActive = this.classList.contains('active');

                    if (isActive) {
                        const { source, gainNode } = reproducirAudio(fuentesAudio[this.id].buffer);
                        fuentesAudio[this.id] = { ...fuentesAudio[this.id], source, gainNode };
                        const seccionId = this.dataset.section.replace('volumen-', '');
                        const volumenOriginal = volumenesOriginales[this.dataset.section] ?? 0.5;
                        const debeSonar = seccionDebeSonar(seccionId);
                        gainNode.gain.setValueAtTime(debeSonar && !enPausa ? volumenOriginal : 0, contextoAudio.currentTime);
                    } else {
                        if (fuentesAudio[this.id].source) {
                            fuentesAudio[this.id].source.stop();
                            fuentesAudio[this.id].source = null;
                            fuentesAudio[this.id].gainNode = null;
                        }
                    }
                    actualizarBotonesDeAudios();
                });
            });
        });
        // Llama a actualizarVisualizador aquí también para mostrar el placeholder inicial
        actualizarVisualizador();
    }
    
    // El resto del código permanece igual

    document.addEventListener('valuechange', (event) => {
        const { id, value } = event.detail;
        const gainValue = value / 100;
        if (!isFinite(gainValue)) return;

        if (id === 'volumen') { // Volumen Maestro
            masterGainNode.gain.setValueAtTime(gainValue, contextoAudio.currentTime);
        } else if (id.startsWith('volumen-')) { // Volúmenes de Categoría
            volumenesOriginales[id] = gainValue; // Actualizar el volumen de referencia
            Object.keys(fuentesAudio).forEach(key => {
                const btn = document.getElementById(key);
                if (!btn || btn.dataset.section !== id) return; 
                
                const fuente = fuentesAudio[key];
                if (fuente.gainNode) {
                    const seccionId = id.replace('volumen-', '');
                    const debeSonar = seccionDebeSonar(seccionId);
                    if (!enPausa) {
                        fuente.gainNode.gain.setValueAtTime(debeSonar ? gainValue : 0, contextoAudio.currentTime);
                    }
                }
            });
        }
    });

    function actualizarEstadoAudio() {
        Object.keys(fuentesAudio).forEach(key => {
            const fuente = fuentesAudio[key];
            const btn = document.getElementById(key);
            if(fuente.gainNode && btn){
                 const seccionId = btn.dataset.section.replace('volumen-', '');
                 const debeSonar = seccionDebeSonar(seccionId);
                 const gainValue = volumenesOriginales[btn.dataset.section] ?? 0.5;
                 if(!enPausa){
                    fuente.gainNode.gain.setValueAtTime(debeSonar ? gainValue : 0, contextoAudio.currentTime);
                 }
            }
        });
        actualizarBotonesDeAudios();
    }

    const botonEncender = document.getElementById('encender');
    const botonDetener = document.getElementById('detener');
    const botonGrabar = document.getElementById('grabar');
    const botonDescargar = document.getElementById('descargar');

    botonEncender.addEventListener('click', function() {
        consolaEncendida = !consolaEncendida;
        this.classList.toggle('activo');
        if (consolaEncendida) {
            contextoAudio.resume();
            enPausa = false;
        } else {
            Object.values(fuentesAudio).forEach(fuente => {
                if (fuente.source) {
                    fuente.source.stop();
                    fuente.source = null;
                }
            });
             document.querySelectorAll('.selector, .mute, .solo').forEach(b => b.classList.remove('active', 'sonando', 'activo'));
             
             document.querySelectorAll('.deslizador-vertical-js').forEach(container => {
                if (container.__deslizadorVertical__) {
                    container.__deslizadorVertical__.valor = 50;
                    container.__deslizadorVertical__.dibujar();
                }
             });
             const volGeneral = document.getElementById('volumen').__deslizadorCircular__;
             if(volGeneral) {
                volGeneral.valor = 50;
                volGeneral.dibujar();
                volGeneral.emitirCambioValor();
             }
        }
        botonDetener.querySelector('i').className = `fa-solid ${consolaEncendida && !enPausa ? 'fa-pause' : 'fa-play'}`;
        actualizarBotonesDeAudios();
        actualizarVisualizador();
    });

    botonDetener.addEventListener('click', () => {
        if (!consolaEncendida) return;
        enPausa = !enPausa;
        Object.values(fuentesAudio).forEach(fuente => {
            if (fuente.gainNode) {
                const btn = Object.keys(fuentesAudio).find(key => fuentesAudio[key] === fuente);
                const seccionId = document.getElementById(btn).dataset.section.replace('volumen-', '');
                const debeSonar = seccionDebeSonar(seccionId);
                const gainValue = volumenesOriginales[document.getElementById(btn).dataset.section] ?? 0.5;
                fuente.gainNode.gain.setValueAtTime(enPausa || !debeSonar ? 0 : gainValue, contextoAudio.currentTime);
            }
        });
        botonDetener.querySelector('i').className = `fa-solid ${enPausa ? 'fa-play' : 'fa-pause'}`;
        actualizarBotonesDeAudios();
    });

    let mediaRecorder, grabando = false, chunks = [], grabacionBlob = null;
    const mediaStreamDestinoGlobal = contextoAudio.createMediaStreamDestination();

    botonGrabar.addEventListener('click', () => {
        if (!consolaEncendida) return;
        grabando = !grabando;
        botonGrabar.classList.toggle('activo', grabando);
        if (grabando) {
            chunks = [];
            masterGainNode.connect(mediaStreamDestinoGlobal);
            mediaRecorder = new MediaRecorder(mediaStreamDestinoGlobal.stream);
            mediaRecorder.ondataavailable = e => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                grabacionBlob = new Blob(chunks, { type: 'audio/webm' });
                botonDescargar.disabled = false;
                masterGainNode.disconnect(mediaStreamDestinoGlobal);
            };
            mediaRecorder.start();
        } else {
            mediaRecorder.stop();
        }
    });

    botonDescargar.addEventListener('click', async () => {
        if (!grabacionBlob) return;
        const arrayBuffer = await grabacionBlob.arrayBuffer();
        const audioBuffer = await contextoAudio.decodeAudioData(arrayBuffer);
        const wavBlob = new Blob([audioBufferToWav(audioBuffer)], { type: 'audio/wav' });
        const url = URL.createObjectURL(wavBlob);
        const a = Object.assign(document.createElement('a'), { href: url, download: 'grabacion_etnodj.wav', style: "display:none" });
        document.body.appendChild(a).click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    document.querySelectorAll('.mute, .solo').forEach(btn => {
        btn.addEventListener('click', function() {
            if (!consolaEncendida) return;
            this.classList.toggle('activo');
            if(this.classList.contains('mute')){
                 const icono = this.querySelector('i');
                 icono.classList.toggle('fa-volume-high');
                 icono.classList.toggle('fa-volume-xmark');
            }
            actualizarEstadoAudio();
        });
    });

});
