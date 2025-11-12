document.addEventListener('DOMContentLoaded', function() {
    const tooltip = document.createElement('div');
    tooltip.id = 'audio-tooltip';
    document.body.appendChild(tooltip);

    const botonesAudio = document.querySelectorAll('.selector');
    const visualizador = document.querySelector('.visualizador');

    let consolaEncendida = false;
    let enPausa = false;

    // Objeto para almacenar la información de los audios del CSV
    const audioMetadata = {};

    // --- INICIO: Lógica MIDI para TouchDesigner ---
    let midiOutput = null;
    // ¡IMPORTANTE! Revisa que este nombre sea exacto.
    const nombrePuertoVirtual = "Driver IAC Bus 1"; 

    async function setupMidi() {
        try {
            const midiAccess = await navigator.requestMIDIAccess();
            console.log("Acceso MIDI obtenido.");

            for (let output of midiAccess.outputs.values()) {
                if (output.name.includes(nombrePuertoVirtual)) {
                    midiOutput = output;
                    console.log(`Puerto MIDI encontrado y conectado: ${output.name}`);
                    break;
                }
            }

            if (!midiOutput) {
                console.warn(`ADVERTENCIA: No se pudo encontrar el puerto MIDI con el nombre: "${nombrePuertoVirtual}". Asegúrate de que loopMIDI (Windows) o IAC Driver (Mac) estén activos y con el nombre correcto.`);
            }

        } catch (error) {
            console.error("No se pudo acceder a los dispositivos MIDI.", error);
        }
    }
    // --- FIN: Lógica MIDI para TouchDesigner ---


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
        setupMidi(); // Llamar a setupMidi DESPUÉS de cargar el CSV
    }).catch(error => {
        console.error('Error al cargar o parsear el CSV:', error);
    });
    // --- FIN: Carga y parseo del CSV ---

    // --- INICIO: Inicialización de componentes ---
    new DeslizadorCircular(document.getElementById('volumen'), { value: 50, id: 'volumen' });

    document.querySelectorAll('.deslizador-vertical-js').forEach(container => {
        const id = container.id;
        new DeslizadorVertical(container, { id: id, value: 50 });
    });
    // --- FIN: Inicialización de componentes ---
    
    // --- INICIO: Mapa de Notas MIDI ---
    // Objeto para mapear IDs de botones a notas MIDI
    const midiNoteMap = {
        // Notas 1-59: Selectores de Audio (34) - Se asignan dinámicamente
        // Notas 60-69: Controles Globales
        'encender': 60,
        'detener': 61,
        // 'grabar': 62, // Sin asignar por ahora
        // 'descargar': 63, // Sin asignar por ahora
        
        // Notas 70-79: Botones de "Solo"
        'solo-armonia': 70,
        'solo-melodia': 71,
        'solo-ritmo': 72,
        'solo-fondo': 73,
        'solo-adornos': 74,
        
        // Notas 80-89: Botones de "Mute"
        'mute-armonia': 80,
        'mute-melodia': 81,
        'mute-ritmo': 82,
        'mute-fondo': 83,
        'mute-adornos': 84
    };

    // Objeto para mapear IDs de deslizadores a Controladores MIDI (CC)
    const midiCCMap = {
        'volumen': 7,          // Volumen General (CC 7 es estándar)
        'volumen-armonia': 10,
        'volumen-melodia': 11,
        'volumen-ritmo': 12,
        'volumen-fondo': 13,
        'volumen-adornos': 14
    };
    // --- FIN: Mapa de Notas MIDI ---


    function actualizarVisualizador() {
        while (visualizador.firstChild) {
            visualizador.removeChild(visualizador.firstChild);
        }

        const audiosSeleccionados = document.querySelectorAll('.selector.active');
        
        if (!consolaEncendida || audiosSeleccionados.length === 0) {
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
            const audioFileName = boton.getAttribute('data-audio').split('/').pop().normalize('NFC');
            const metadata = audioMetadata[audioFileName];
            let displayText = '';

            if (metadata) {
                displayText = `${metadata.title} - Región ${metadata.region} - ${metadata.department}.`;
            } else {
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
        // Asignar una nota MIDI única a cada botón
        botonesAudio.forEach((button, index) => {
            button.dataset.active = 'false';
            const audioUrl = button.getAttribute('data-audio');
            const sectionId = button.closest('.fila').dataset.section;
            button.setAttribute('data-section', sectionId);

            // Asignar Nota MIDI (empezando desde 1)
            const midiNote = index + 1; // De 1 a 34
            button.setAttribute('data-midi-note', midiNote);
            
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

            // --- LÓGICA DE AUDIO WEB ELIMINADA ---
            // Ya no se carga audio aquí
                
            button.addEventListener('click', function() {
                if (!consolaEncendida) return;
                this.classList.toggle('active');
                actualizarVisualizador();
                
                const isActive = this.classList.contains('active');

                // --- INICIO: Enviar MIDI para este botón ---
                const midiNote = parseInt(this.getAttribute('data-midi-note'), 10);
                if (midiOutput && midiNote > 0) {
                    if (isActive) {
                        // Note On: 144, Nota, Velocidad
                        midiOutput.send([144, midiNote, 127]);
                    } else {
                        // Note Off: 128, Nota, Velocidad (0)
                        midiOutput.send([128, midiNote, 0]);
                    }
                }
                // --- FIN: Enviar MIDI para este botón ---

                // --- LÓGICA DE AUDIO WEB ELIMINADA ---
                
                actualizarBotonesDeAudios();
            });
        });
        actualizarVisualizador();
    }
    
    // --- Listener de Deslizadores (MIDI CC) ---
    document.addEventListener('valuechange', (event) => {
        const { id, value } = event.detail;
        
        // Mapear el ID del deslizador a su número de CC
        const cc = midiCCMap[id];
        
        if (midiOutput && cc !== undefined) {
            // Convertir valor (0-100) a MIDI (0-127)
            const midiValue = Math.round(value * 1.27);
            // Enviar mensaje de Control Change: [176, CC, Valor]
            midiOutput.send([176, cc, midiValue]);
            // console.log(`MIDI CC Enviado: ID=${id}, CC=${cc}, Valor=${midiValue}`);
        }
    });

    function actualizarEstadoAudio() {
        // --- LÓGICA DE AUDIO WEB ELIMINADA ---
        actualizarBotonesDeAudios();
    }

    const botonEncender = document.getElementById('encender');
    const botonDetener = document.getElementById('detener'); // Botón Pausa/Play
    const botonGrabar = document.getElementById('grabar');
    const botonDescargar = document.getElementById('descargar');

    botonEncender.addEventListener('click', function() {
        consolaEncendida = !consolaEncendida;
        this.classList.toggle('activo');
        if (consolaEncendida) {
            // contextoAudio.resume(); // Eliminado
            enPausa = false;
            actualizarVisualizador();

            // --- Enviar MIDI Encendido ---
            if (midiOutput) {
                const midiNote = midiNoteMap['encender']; // 60
                // Nota 60 ON
                midiOutput.send([144, midiNote, 127]);
                console.log("Mensaje MIDI 'Encendido' (Nota 60) enviado a TD.");
            }

        } else {
            // --- INICIO: LÓGICA DE APAGADO ---

            // 1. --- LÓGICA DE AUDIO WEB ELIMINADA ---

            // 2. --- CORRECCIÓN DE ORDEN: ENVIAR MIDI ANTES DE LIMPIAR UI ---
            if (midiOutput) {
                // Nota 60 OFF (Apagado)
                midiOutput.send([128, midiNoteMap['encender'], 0]); 
                console.log("Mensaje MIDI 'Apagado' (Nota 60) enviado a TD.");
                
                // Nota 61 OFF (Pausa OFF) - Sincronizar estado
                midiOutput.send([128, midiNoteMap['detener'], 0]);
                console.log("Mensaje MIDI 'Pausa OFF' (Nota 61) enviado a TD.");

                // --- INICIO: CORRECCIÓN DE SINCRONIZACIÓN ---
                // Buscar todos los botones de audio que estén activos
                document.querySelectorAll('.selector.active').forEach(botonActivo => {
                    const midiNote = parseInt(botonActivo.getAttribute('data-midi-note'), 10);
                    if (midiNote > 0) {
                        // Enviar su mensaje "Note Off"
                        midiOutput.send([128, midiNote, 0]);
                    }
                });
                console.log("Mensajes MIDI 'Audio OFF' enviados para todos los canales activos.");
                
                // Apagar todos los Mute/Solo activos
                document.querySelectorAll('.mute.activo, .solo.activo').forEach(botonControl => {
                    const midiNote = midiNoteMap[botonControl.id];
                    if (midiNote) {
                        midiOutput.send([128, midiNote, 0]);
                    }
                });
                console.log("Mensajes MIDI 'Mute/Solo OFF' enviados.");
                // --- FIN: CORRECCIÓN DE SINCRONIZACIÓN ---
            }
            // --- FIN: CORRECCIÓN DE ORDEN ---


            // 3. Limpiar UI (Botones, sliders, etc.)
             document.querySelectorAll('.selector, .mute, .solo').forEach(b => b.classList.remove('active', 'sonando', 'activo'));
             
             // --- ¡INICIO DE LA CORRECCIÓN! ---
             // Resetear los iconos de Mute a su estado inicial ("sonando")
             document.querySelectorAll('.mute i').forEach(icono => {
                icono.classList.remove('fa-volume-xmark');
                icono.classList.add('fa-volume-high');
             });
             // --- FIN DE LA CORRECCIÓN ---
             
             document.querySelectorAll('.deslizador-vertical-js').forEach(container => {
                if (container.__deslizadorVertical__) {
                    container.__deslizadorVertical__.valor = 50;
                    container.__deslizadorVertical__.dibujar();
                    // --- AÑADIDO: Enviar MIDI CC de reseteo ---
                    container.__deslizadorVertical__.emitirCambioValor();
                }
             });
             const volGeneral = document.getElementById('volumen').__deslizadorCircular__;
             if(volGeneral) {
                volGeneral.valor = 50;
                volGeneral.dibujar();
                volGeneral.emitirCambioValor();
             }
            grabando = false;
            // audiosUtilizadosEnGrabacion.clear(); // Eliminado
            botonGrabar.classList.remove('activo');
            botonDescargar.disabled = true;

            // 4. Limpiar visualizador
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

        // 5. Actualizar UI de botones
        botonDetener.querySelector('i').className = `fa-solid ${consolaEncendida && !enPausa ? 'fa-pause' : 'fa-play'}`;
        actualizarBotonesDeAudios();
        actualizarVisualizador();
    });

    botonDetener.addEventListener('click', () => {
        if (!consolaEncendida) return;
        enPausa = !enPausa;

        // --- Enviar MIDI Pausa/Reanudar ---
        if (midiOutput) {
            const midiNote = midiNoteMap['detener']; // 61
            if (enPausa) {
                // Nota 61 ON (Pausa)
                midiOutput.send([144, midiNote, 127]);
                console.log("Mensaje MIDI 'Pausa ON' (Nota 61) enviado a TD.");
            } else {
                // Nota 61 OFF (Reanudar)
                midiOutput.send([128, midiNote, 0]);
                console.log("Mensaje MIDI 'Pausa OFF' (Nota 61) enviado a TD.");
            }
        }
        // --- FIN: Enviar MIDI Pausa/Reanudar ---


        // --- LÓGICA DE AUDIO WEB ELIMINADA ---
        
        botonDetener.querySelector('i').className = `fa-solid ${enPausa ? 'fa-play' : 'fa-pause'}`;
        actualizarBotonesDeAudios();
    });

    
    // --- LÓGICA DE GRABACIÓN ELIMINADA ---
    // (botonGrabar, botonDescargar, mediaRecorder, etc.)
    // Los botones siguen existiendo en el HTML, pero no tienen funcionalidad de audio.


    // --- Listener para Mute/Solo ---
    document.querySelectorAll('.mute, .solo').forEach(btn => {
        btn.addEventListener('click', function() {
            if (!consolaEncendida) return;
            this.classList.toggle('activo');
            
            // --- Enviar MIDI para Mute/Solo ---
            const midiNote = midiNoteMap[this.id];
            if (midiOutput && midiNote) {
                if (this.classList.contains('activo')) {
                    midiOutput.send([144, midiNote, 127]); // Note ON
                    // console.log(`MIDI ON: ${this.id} (Nota ${midiNote})`);
                } else {
                    midiOutput.send([128, midiNote, 0]); // Note OFF
                    // console.log(`MIDI OFF: ${this.id} (Nota ${midiNote})`);
                }
            }
            // --- FIN: Enviar MIDI Mute/Solo ---

            if(this.classList.contains('mute')){
                 const icono = this.querySelector('i');
                 icono.classList.toggle('fa-volume-high');
                 icono.classList.toggle('fa-volume-xmark');
            }
            actualizarEstadoAudio();
        });
    });

});