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

    // Mapa para almacenar los audios únicos utilizados durante la grabación para la factura
    let audiosUtilizadosEnGrabacion = new Map();

    // --- INICIO: Carga y parseo del CSV ---
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
            if (values.length > 1) {
                const fileName = values[0];
                const title = values[1];
                const region = values[3];
                const department = values[4];
                const author = values[5]; // Columna 6: Autor / Archivo
                if (fileName && title && region && department && author) {
                    audioMetadata[fileName.trim().normalize('NFC')] = {
                        title: title.trim(),
                        region: region.trim(),
                        department: department.trim(),
                        author: author.trim() // Guardar el autor
                    };
                }
            }
        });
    }

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
        result.push(currentField);
        return result;
    }

    parseCSV('Consola.csv').then(() => {
        console.log('Metadatos de audio cargados:', audioMetadata);
        inicializarBotonesAudio();
        actualizarVisualizador(); 
    }).catch(error => {
        console.error('Error al cargar o parsear el CSV:', error);
    });
    // --- FIN: Carga y parseo del CSV ---

    // --- INICIO: Inicialización de componentes ---
    new DeslizadorCircular(document.getElementById('volumen'), { value: 50, id: 'volumen' });

    document.querySelectorAll('.deslizador-vertical-js').forEach(container => {
        const id = container.id;
        new DeslizadorVertical(container, { id: id, value: 50 });
        volumenesOriginales[id] = 0.5;
    });
    // --- FIN: Inicialización de componentes ---

    function actualizarVisualizador() {
        // 1. Verificar estado de la consola y selección
        const audiosSeleccionados = document.querySelectorAll('.selector.active');
        
        // --- CASO 1: CONSOLA APAGADA O SIN AUDIOS ---
        if (!consolaEncendida || audiosSeleccionados.length === 0) {
            if (visualizador.querySelector('.visualizador-placeholder')) return;
    
            visualizador.innerHTML = '';
            
            const placeholder = document.createElement('div');
            placeholder.className = 'visualizador-placeholder';
            
            const img = document.createElement('img');
            img.src = 'Imagenes/etno-dj.png';
            img.alt = 'Visualizador EtnoDJ';
            img.style.maxWidth = '80%';
            img.style.maxHeight = '80%';
            img.style.borderRadius = '12px';
            img.style.margin = 'auto';
            img.style.opacity = '1';
            
            placeholder.appendChild(img);
            visualizador.appendChild(placeholder);
            return;
        }
    
        // --- CASO 2: HAY AUDIOS REPRODUCIÉNDOSE ---
        
        // Si hay un placeholder (imagen), lo quitamos
        const placeholder = visualizador.querySelector('.visualizador-placeholder');
        if (placeholder) {
            visualizador.removeChild(placeholder);
        }
    
        // --- NUEVO: INSERTAR TÍTULO CON ESTILOS PERSONALIZADOS ---
        // Verificamos si ya existe el título para no duplicarlo
        let titulo = visualizador.querySelector('.visualizador-titulo');
        if (!titulo) {
            titulo = document.createElement('h3');
            titulo.className = 'visualizador-titulo';
            titulo.textContent = 'Audios activos';
            
            // Estilos solicitados específicamente
            titulo.style.fontSize = 'clamp(0.7rem, 1.2vw, 1.1rem)';
            titulo.style.fontWeight = 'bold';
            titulo.style.margin = '0';
            titulo.style.marginBottom = '5px';
            titulo.style.wordBreak = 'break-word';
            
            // Estilos base para alineación (necesarios para que se vea bien centrado)
            titulo.style.width = '100%';
            titulo.style.textAlign = 'center';
            titulo.style.color = 'black'; 
            
            // Lo insertamos al principio de la lista
            visualizador.prepend(titulo);
        }
        // -----------------------------
    
        // Identificamos qué audios deberían estar
        const audiosActivosSet = new Set();
        audiosSeleccionados.forEach(btn => audiosActivosSet.add(btn.getAttribute('data-audio')));
    
        // 1. LIMPIEZA: Eliminar items que ya no están activos
        const itemsExistentes = Array.from(visualizador.querySelectorAll('.visualizador-item'));
        itemsExistentes.forEach(item => {
            if (!item.dataset.audioSrc || !audiosActivosSet.has(item.dataset.audioSrc)) {
                // Verificamos si el item está dentro de un contenedor máscara para borrar el padre completo
                if (item.parentElement.classList.contains('visualizador-item-container')) {
                    item.parentElement.remove();
                } else {
                    item.remove();
                }
            }
        });
    
        // 2. CREACIÓN / ACTUALIZACIÓN
        const categorias = ['armonia', 'melodia', 'ritmo', 'fondo', 'adornos'];
    
        audiosSeleccionados.forEach(boton => {
            const audioSrc = boton.getAttribute('data-audio');
            
            // Buscar si ya existe este item en el DOM
            let item = visualizador.querySelector(`.visualizador-item[data-audio-src="${audioSrc}"]`);
    
            // Preparar texto
            const audioFileName = audioSrc.split('/').pop().normalize('NFC');
            const metadata = audioMetadata[audioFileName];
            let displayText = '';
    
            if (metadata) {
                displayText = `${metadata.title} - Región ${metadata.region} - ${metadata.department}`;
            } else {
                const nombreArchivoSinExtension = audioFileName.replace(/\.[^/.]+$/, "").replace(/_/g, ' ');
                displayText = nombreArchivoSinExtension.charAt(0).toUpperCase() + nombreArchivoSinExtension.slice(1);
            }
    
            // Si no existe, lo creamos (inicialmente SIN contenedor extra)
            if (!item) {
                item = document.createElement('div');
                item.className = 'visualizador-item';
                item.dataset.audioSrc = audioSrc;
                item.textContent = displayText;
    
                // Estilos base
                item.style.display = 'block'; 
                item.style.marginBottom = '2px'; 
                item.style.whiteSpace = 'nowrap'; 
                item.style.width = 'fit-content';  
    
                // Color por categoría
                for (const cat of categorias) {
                    if (boton.classList.contains(cat)) {
                        item.classList.add(cat);
                        break;
                    }
                }
                visualizador.appendChild(item);
            } 
            
            // 3. MEDICIÓN INTELIGENTE
            const clone = item.cloneNode(true);
            clone.style.display = 'inline-block';
            clone.style.position = 'absolute';
            clone.style.visibility = 'hidden';
            clone.style.width = 'auto'; 
            clone.classList.remove('desplazando'); 
            
            
            document.body.appendChild(clone);
            const anchoTexto = clone.offsetWidth;
            // Medimos el ancho disponible del visualizador (restando un poco de padding de seguridad)
            // Usamos el visualizador como referencia base si no tiene contenedor aún
            let anchoDisponible = visualizador.clientWidth - 10; 
            // Si ya tiene contenedor, usamos el ancho del contenedor padre
            if (item.parentElement.classList.contains('visualizador-item-container')) {
                anchoDisponible = item.parentElement.clientWidth;
            }
    
            document.body.removeChild(clone);
    
            // 4. APLICAR LÓGICA CONDICIONAL: ¿Necesita envoltura y animación?
            if (anchoTexto > anchoDisponible) {
                
                // --- NECESITA ANIMACIÓN (TEXTO LARGO) ---
    
                // A. Si NO tiene contenedor aún, se lo creamos
                if (!item.parentElement.classList.contains('visualizador-item-container')) {
                    const container = document.createElement('div');
                    container.className = 'visualizador-item-container';
                    
                    // Estilos del contenedor máscara
                    container.style.width = '100%';
                    container.style.overflow = 'hidden'; // Aquí ocurre la magia del recorte
                    container.style.flexShrink = '0';
                    container.style.borderRadius = '6px';
                    container.style.marginLeft = '5px'; 
    
                    // Insertamos el contenedor donde estaba el item y movemos el item dentro
                    item.parentElement.insertBefore(container, item);
                    container.appendChild(item);
                }
    
                // B. Activamos la animación y ajustamos estilos del item
                if (!item.classList.contains('desplazando')) {
                    item.classList.add('desplazando');
                    item.style.display = 'block'; 
                    item.style.width = 'auto'; 
                    item.style.marginLeft = '-5px'; 
                }
    
            } else {
    
                // --- NO NECESITA ANIMACIÓN (TEXTO CORTO) ---
    
                // A. Si TIENE contenedor (sobra), lo quitamos ("desenvolver")
                if (item.parentElement.classList.contains('visualizador-item-container')) {
                    const container = item.parentElement;
                    // Movemos el item fuera del container, justo antes del container
                    container.parentElement.insertBefore(item, container);
                    // Eliminamos el container vacío
                    container.remove();
                }
    
                // B. Desactivamos animación y restauramos estilos simples
                item.classList.remove('desplazando');
                item.style.width = 'fit-content'; 
            }
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
            const sectionId = section.replace('volumen-', '');
            const debeSonar = seccionDebeSonar(sectionId);
            button.classList.toggle('sonando', button.classList.contains('active') && debeSonar && !enPausa);
        });
    }

    function inicializarBotonesAudio() {
        botonesAudio.forEach((button) => {
            button.dataset.active = 'false';
            const audioUrl = button.getAttribute('data-audio');
            const sectionId = button.closest('.fila').dataset.section;
            button.setAttribute('data-section', sectionId);
            
            if (audioUrl) {
                const audioFileName = audioUrl.split('/').pop().normalize('NFC');
                const metadata = audioMetadata[audioFileName];
                let tooltipText = metadata ? metadata.title : audioFileName.replace(/\.[^/.]+$/, "").replace(/_/g, ' ');
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
                        
                        if (grabando) {
                            const audioFileName = this.getAttribute('data-audio').split('/').pop().normalize('NFC');
                            const metadata = audioMetadata[audioFileName];
                            if (metadata) {
                                audiosUtilizadosEnGrabacion.set(audioFileName, metadata);
                            }
                        }

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
        actualizarVisualizador();
    }
    
    document.addEventListener('valuechange', (event) => {
        const { id, value } = event.detail;
        const gainValue = value / 100;
        if (!isFinite(gainValue)) return;

        if (id === 'volumen') {
            masterGainNode.gain.setValueAtTime(gainValue, contextoAudio.currentTime);
        } else if (id.startsWith('volumen-')) {
            volumenesOriginales[id] = gainValue;
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
            actualizarVisualizador();
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
            grabando = false;
            audiosUtilizadosEnGrabacion.clear();
            botonGrabar.classList.remove('activo');
            botonDetener.classList.add('desactivado');
            botonDescargar.disabled = true;

            // Limpia y muestra placeholder directamente al apagar
            while (visualizador.firstChild) {
                visualizador.removeChild(visualizador.firstChild);
            }
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
        }
        botonDetener.querySelector('i').className = `fa-solid ${consolaEncendida && !enPausa ? 'fa-pause' : 'fa-play'}`;

        if (botonDetener.querySelector('i').className  === 'fa-solid fa-pause' ) {
            botonDetener.classList.add('desactivado'); // Agrega la clase para el fondo
        } else {
            botonDetener.classList.remove('desactivado'); // Elimina la clase si no está en pausa
        }
        
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
        if (botonDetener.querySelector('i').className  === 'fa-solid fa-pause' ) {
            botonDetener.classList.add('desactivado'); // Agrega la clase para el fondo
        } else {
            botonDetener.classList.remove('desactivado'); // Elimina la clase si no está en pausa
        }
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
            audiosUtilizadosEnGrabacion.clear();

            document.querySelectorAll('.selector.active').forEach(button => {
                const audioFileName = button.getAttribute('data-audio').split('/').pop().normalize('NFC');
                const metadata = audioMetadata[audioFileName];
                if (metadata) {
                    audiosUtilizadosEnGrabacion.set(audioFileName, metadata);
                }
            });

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

    function crearYDescargarFactura() {
        if (audiosUtilizadosEnGrabacion.size === 0) {
            console.log("No se utilizaron audios en la grabación. No se genera factura.");
            return;
        }
    
        const fecha = new Date();
        const fechaFormato = fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const horaFormato = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
        let contenidoFactura = `🧾 ETNODJ - FACTURA DE GRABACIÓN\n\n`;
        contenidoFactura += `Fecha: ${fechaFormato}, ${horaFormato}\n`;
        contenidoFactura += `Audios utilizados:\n\n`;
    
        let contador = 1;
        audiosUtilizadosEnGrabacion.forEach((metadata) => {
            const nombre = metadata.title;
            const region = metadata.region;
            const depto = metadata.department;
            const autor = metadata.author;
            contenidoFactura += `${contador}. ${nombre} - Región ${region} - ${depto} - Autor: ${autor}\n`;
            contador++;
        });
    
        contenidoFactura += `\n\nTotal: ${audiosUtilizadosEnGrabacion.size} audio(s)\n\n`;
        contenidoFactura += `¡Gracias por usar ETNODJ!\n\n`;
        contenidoFactura += `---------------------------------\n`;
        contenidoFactura += `Licencia: (CC BY-NC-SA 4.0).\n`;
        contenidoFactura += `Usted es libre de compartir y adaptar el material para fines no comerciales, siempre y cuando dé el crédito apropiado, proporcione un enlace a la licencia e indique si se han realizado cambios.`;
    
        const nombreArchivo = `factura_etnodj_${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, '0')}${String(fecha.getDate()).padStart(2, '0')}.txt`;
        const blob = new Blob([contenidoFactura], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreArchivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    botonDescargar.addEventListener('click', async () => {
        if (!grabacionBlob) return;
        
        // Descargar el archivo de audio en formato WAV
        // La función audioBufferToWav es provista por la librería externa cargada en index.html
        try {
            const arrayBuffer = await grabacionBlob.arrayBuffer();
            const audioBuffer = await contextoAudio.decodeAudioData(arrayBuffer);
            const wavData = audioBufferToWav(audioBuffer);
            const wavBlob = new Blob([wavData], { type: 'audio/wav' });
            const urlAudio = URL.createObjectURL(wavBlob);
            const aAudio = Object.assign(document.createElement('a'), { href: urlAudio, download: 'grabacion_etnodj.wav', style: "display:none" });
            document.body.appendChild(aAudio).click();
            document.body.removeChild(aAudio);
            URL.revokeObjectURL(urlAudio);
        } catch (error) {
            console.error("Error al convertir la grabación a WAV:", error);
            alert("Hubo un error al procesar el audio. La descarga no pudo completarse.");
        }

        // Crear y descargar la factura en formato TXT
        crearYDescargarFactura();

        botonDescargar.disabled = true;
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
