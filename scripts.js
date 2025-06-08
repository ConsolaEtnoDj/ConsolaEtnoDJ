document.addEventListener('DOMContentLoaded', function() {
    const botonesAudio = document.querySelectorAll('.selector');
    const contextoAudio = new (window.AudioContext || window.webkitAudioContext)();
    const masterGainNode = contextoAudio.createGain();
    masterGainNode.gain.setValueAtTime(1, contextoAudio.currentTime); // Volumen general al 100% inicialmente
    masterGainNode.connect(contextoAudio.destination);

    const fuentesAudio = {};
    const volumenesOriginales = {};
    let tonosOriginales = {}; // Almacena los valores de tono (playbackRate)
    let consolaEncendida = false; // Indica si la consola esta encendida o apagada
    let enPausa = false; // Indica si la consola esta en pausa cuando activo y en reproducción cuando no

    function cargarAudio(url) {
        return fetch(url)
            .then(response => response.arrayBuffer())
            .then(buffer => contextoAudio.decodeAudioData(buffer));
    }

    /**
     * Inicia una fuente de audio para un botón específico.
     * Crea el BufferSource, ajusta el volumen y el tono,
     * y lo conecta al pipeline de audio.
     * @param {HTMLElement} button - El botón del selector que se está activando.
     */
    function iniciarFuenteAudio(button) {
        const id = button.id;
        if (!fuentesAudio[id] || !fuentesAudio[id].buffer) return; // Chequeo de seguridad

        const section = button.dataset.section;
        const seccionIdVolumen = section;
        const seccionIdTono = section.replace('volumen-', 'tono-');

        const volumenOriginal = volumenesOriginales[seccionIdVolumen] ?? 0.5;
        const tonoOriginal = tonosOriginales[seccionIdTono] ?? 1.0; // playbackRate, 1.0 es el tono normal
        const debeSonar = seccionDebeSonar(section.replace('volumen-', ''));

        // Crear y configurar el nodo de la fuente de audio
        const source = contextoAudio.createBufferSource();
        source.buffer = fuentesAudio[id].buffer;
        source.loop = true;
        source.playbackRate.value = tonoOriginal; // Aplicar el tono guardado

        // Crear y configurar el nodo de ganancia (volumen)
        const gainNode = contextoAudio.createGain();
        if (enPausa) {
            gainNode.gain.setValueAtTime(0, contextoAudio.currentTime);
        } else {
            gainNode.gain.setValueAtTime(debeSonar ? volumenOriginal : 0, contextoAudio.currentTime);
        }

        // Conectar los nodos
        source.connect(gainNode).connect(masterGainNode);
        source.start();

        // Almacenar nodos y estado
        fuentesAudio[id].source = source;
        fuentesAudio[id].gainNode = gainNode;
        fuentesAudio[id].debeSonar = debeSonar;

        // Conectar a la grabadora si está activa
        if (grabando) {
            gainNode.connect(mediaStreamDestinoGlobal);
        }
    }


    function seccionDebeSonar(sectionId) {
        const muteBtn = document.getElementById(`mute-${sectionId}`);
        const soloBtn = document.getElementById(`solo-${sectionId}`);
        const haySoloActivo = Array.from(document.querySelectorAll('.solo')).some(b => b.classList.contains('activo'));
        const estaEnSolo = soloBtn && soloBtn.classList.contains('activo');
        const estaMuteada = muteBtn && muteBtn.classList.contains('activo');

        if (estaMuteada) {
            return false; // Si está muteado, nunca debe sonar
        }
        if (haySoloActivo) {
            return estaEnSolo; // Si hay algún solo activo, solo deben sonar los que están en solo
        }
        return true; // Si no hay solo activo y no está muteado, debe sonar
    }

    function actualizarBotonesDeAudios() {
        botonesAudio.forEach(button => {
            const section = button.dataset.section;
            if (!section) return;
            
            const seccionId = section.replace('volumen-', '');
            const muteBtn = document.getElementById(`mute-${seccionId}`);
            const soloBtn = document.getElementById(`solo-${seccionId}`);
            const haySoloActivo = Array.from(document.querySelectorAll('.solo')).some(b => b.classList.contains('activo'));
            const estaMuteada = muteBtn && muteBtn.classList.contains('activo');
            const estaEnSolo = soloBtn && soloBtn.classList.contains('activo');
    
            let debeSonar = false;
            if (estaMuteada) {
                debeSonar = false;
            } else if (haySoloActivo) {
                debeSonar = estaEnSolo;
            } else {
                debeSonar = true;
            }
    
            if (button.classList.contains('active') && debeSonar) {
                button.classList.add('sonando');
            } else {
                button.classList.remove('sonando');
            }
        });
    }    

    function actualizarColorBoton(button){
        // Opacidad completa cuando está activo sino 50% de opacidad
        button.style.opacity = button.classList.contains('active') ? "1" : "0.5";
    }

    // Botones selectores de audio
    botonesAudio.forEach((button) => {
        button.dataset.active = 'false';
        const audioUrl = button.getAttribute('data-audio');
        if (!audioUrl) return; // No cargar si no hay audio
        const sectionId = button.closest('.fila').dataset.section;
        button.setAttribute('data-section', sectionId);
        button.style.opacity = "0.5"; // Iniciar todos con opacidad al 50%
    
        cargarAudio(audioUrl).then(audioBuffer => {
            fuentesAudio[button.id] = {
                buffer: audioBuffer,
                source: null,
                gainNode: null // Inicialmente null
            };
    
            button.addEventListener('click', function() {
                if (!consolaEncendida) return; // Si la consola está apagada, no hacer nada
    
                if (this.classList.contains('active')) {
                    this.classList.remove('active');
                    this.dataset.active = 'false';
                    if (fuentesAudio[this.id] && fuentesAudio[this.id].source) {
                        fuentesAudio[this.id].source.stop();
                        fuentesAudio[this.id].source = null;
                    }
                } else {
                    iniciarFuenteAudio(this);

                    if (grabando) {
                        const nombre = this.getAttribute('data-audio').split('/').pop();
                        audiosEnGrabacion.push(nombre);
                    }

                    this.classList.add('active');
                    this.dataset.active = 'true';
                }
                actualizarColorBoton(this);
                actualizarBotonesDeAudios();
            });
        }).catch(error => console.error(`Error loading audio ${audioUrl}:`, error));
    });
    
    // Evento para ajustar el volumen y el tono basado en el deslizador
    document.addEventListener('valuechange', (event) => {
        const { id, value } = event.detail;

        if (id === 'volumen') { 
            const gainValue = value / 100;
            if (!isFinite(gainValue)) return;
            masterGainNode.gain.setValueAtTime(gainValue, contextoAudio.currentTime);
        } else if (id.startsWith('volumen-')) {
            const gainValue = value / 100;
            if (!isFinite(gainValue)) return;
            volumenesOriginales[id] = gainValue;

            Object.keys(fuentesAudio).forEach(key => {
                const btn = document.getElementById(key);
                if (!btn) return;
                if (btn.dataset.section === id) {
                    const fuente = fuentesAudio[key];
                    if (fuente && fuente.gainNode) {
                        const seccionId = id.replace('volumen-', '');
                        const debeSonar = seccionDebeSonar(seccionId);
                        fuente.gainNode.gain.setValueAtTime(debeSonar ? gainValue : 0, contextoAudio.currentTime);
                    }
                }
            });
        } else if (id.startsWith('tono-')) {
            // Mapear valor del deslizador (0-100) a semitonos (-12 a +12)
            const totalSteps = 24;
            const semitones = Math.round((value / 100) * totalSteps) - 12;

            // Calcular playbackRate desde los semitonos. La fórmula es 2^(n/12)
            const playbackRate = Math.pow(2, semitones / 12);
            if (!isFinite(playbackRate)) return;

            tonosOriginales[id] = playbackRate;
            const sectionId = id.replace('tono-', 'volumen-');

            Object.keys(fuentesAudio).forEach(key => {
                const btn = document.getElementById(key);
                if (!btn) return;
                if (btn.dataset.section === sectionId) {
                    const fuente = fuentesAudio[key];
                    if (fuente && fuente.source) {
                        fuente.source.playbackRate.setValueAtTime(playbackRate, contextoAudio.currentTime);
                    }
                }
            });
             // Actualizar el visualizador de tono
            const displayId = `valor-${id}`; // e.g., valor-tono-armonia
            const displayElement = document.getElementById(displayId);
            if (displayElement) {
                let displayValue = semitones > 0 ? `+${semitones}` : `${semitones}`;
                displayElement.textContent = displayValue;
            }
        }
    });

    // Función para actualizar el estado de los audios deacuerdo a los botones de silencio y solo
    function actualizarEstadoAudio() {
        const botonesSolo = document.querySelectorAll('.solo');
        const seccionesActivas = Array.from(botonesSolo).filter(btn => btn.classList.contains('activo')).map(btn => btn.id.replace('solo-', ''));
        
        botonesAudio.forEach(button => {
            if (!button.classList.contains('active')) return; // Solo actualizar los botones activos

            const section = button.dataset.section;
            const seccionId = section.replace('volumen-', '');
            const muteBtn = document.getElementById(`mute-${seccionId}`);
            const soloBtn = document.getElementById(`solo-${seccionId}`);
            const estaMuteada = muteBtn && muteBtn.classList.contains('activo');
            const estaEnSolo = soloBtn && soloBtn.classList.contains('activo');
            const haySoloActivo = seccionesActivas.length > 0;

            let debeSonar = false;
            if (estaMuteada) {
                debeSonar = false;
            } else if (haySoloActivo) {
                debeSonar = estaEnSolo;
            } else {   
                debeSonar = true;
            }

            const fuente = fuentesAudio[button.id];
            const volumenOriginal = volumenesOriginales[section] ?? 0.5;

            if (fuente && fuente.gainNode) {
                if (!enPausa) {
                    fuente.gainNode.gain.setValueAtTime(debeSonar ? volumenOriginal : 0, contextoAudio.currentTime);
                } 
            }
            if (fuente) {
                fuente.debeSonar = debeSonar; // Guardar el estado de si debe sonar o no
            }
           
            actualizarColorBoton(button);
        });
        actualizarBotonesDeAudios();
    }
   
    const botonEncender = document.getElementById('encender');
    const botonDetener = document.getElementById('detener');
    const botonGrabar = document.getElementById('grabar');
    const botonDescargar = document.getElementById('descargar');
    
    // Inicializar color del icono en rojo
    botonEncender.querySelector('i').style.color = 'red';
     // Funcionalidad al botón encender
    botonEncender.addEventListener('click', function() {
        consolaEncendida = !consolaEncendida;
        if (consolaEncendida) {
            if (contextoAudio.state === 'suspended') {
                contextoAudio.resume();
            }
            botonEncender.classList.add('activo');
            botonEncender.querySelector('i').style.color = 'black';
            botonDetener.querySelector('i').classList.remove('fa-play');
            botonDetener.querySelector('i').classList.add('fa-pause');
            enPausa = false; 

        } else {
            botonEncender.classList.remove('activo');
            botonEncender.querySelector('i').style.color = 'red';
            botonDetener.querySelector('i').classList.remove('fa-pause');
            botonDetener.querySelector('i').classList.add('fa-play');
            enPausa = true; 

            // Detener todos los audios
            Object.keys(fuentesAudio).forEach(key => {
                if (fuentesAudio[key] && fuentesAudio[key].source) {
                    fuentesAudio[key].source.stop();
                    fuentesAudio[key].source = null;
                }
            });

            // Desactivar todos los botones
            botonesAudio.forEach(button => {
                button.classList.remove('active','sonando');
                button.dataset.active = 'false';
                actualizarColorBoton(button);
            });
            document.querySelectorAll('.mute, .solo').forEach(button => {
                button.classList.remove('activo');
                const icono = button.querySelector('i');
                if (button.classList.contains('mute')){
                    icono.classList.remove('fa-volume-xmark');
                    icono.classList.add('fa-volume-high');
                }
            });

            // Restablecer valores y deslizadores
            ['volumen', 'volumen-armonia', 'volumen-melodia', 'volumen-ritmo', 'volumen-fondo', 'volumen-adornos'].forEach(id => {
                 const deslizador = document.getElementById(id);
                if (deslizador && deslizador.__deslizadorCircular__) {
                    deslizador.__deslizadorCircular__.valor = 50;
                    deslizador.__deslizadorCircular__.dibujar();
                }
                const evento = new CustomEvent('valuechange', { detail: {id: id, value: 50 } });
                document.dispatchEvent(evento);
            });
            
            ['tono-armonia', 'tono-melodia', 'tono-ritmo', 'tono-fondo', 'tono-adornos'].forEach(id => {
                const deslizador = document.getElementById(id);
                if (deslizador && deslizador.__deslizadorCircular__) {
                    deslizador.__deslizadorCircular__.valor = 50;
                    deslizador.__deslizadorCircular__.dibujar();
                }
                const evento = new CustomEvent('valuechange', { detail: {id: id, value: 50 } });
                document.dispatchEvent(evento);
                 // Reset visualizador de tono
                const displayElement = document.getElementById(`valor-${id}`);
                if (displayElement) {
                    displayElement.textContent = '0';
                }
            });

            tonosOriginales = {};
            volumenesOriginales = {};
        }
    });

    botonDetener.addEventListener('click', () => {
        if (!consolaEncendida) return;
        enPausa = !enPausa;

        if (enPausa) {
            // Pausar todos los audios activos
            Object.keys(fuentesAudio).forEach(key => {
                const fuente = fuentesAudio[key];
                if (fuente && fuente.source) {
                    fuente.source.stop(); // Stop actual
                    fuente.source = null;
                }
            });
    
            // Cambiar ícono a "play"
            botonDetener.querySelector('i').classList.remove('fa-pause');
            botonDetener.querySelector('i').classList.add('fa-play');

        } else {
            // Reanudar todos los audios que estaban activos
            botonesAudio.forEach(button => {
                if (button.classList.contains('active')) {
                    iniciarFuenteAudio(button);
                }
            });
    
            // Cambiar ícono a "pausa"
            botonDetener.querySelector('i').classList.remove('fa-play');
            botonDetener.querySelector('i').classList.add('fa-pause');
        }
    });    

    // Inicializar el botón de grabación y descarga
    let mediaRecorder;
    let grabando = false;
    let chunks = [];
    let audiosEnGrabacion = [];
    let grabacionBlob = null;


    // Crear destino de grabación global
    const mediaStreamDestinoGlobal = contextoAudio.createMediaStreamDestination();

    botonGrabar.addEventListener('click', () => {
        if (!consolaEncendida) return;

        if (!grabando) {
            chunks = [];
            audiosEnGrabacion = [];
            
            Object.values(fuentesAudio).forEach(fuente => {
                if (fuente.source && fuente.gainNode && fuente.debeSonar) {
                    fuente.gainNode.connect(mediaStreamDestinoGlobal);
                }
            });
            
            // Registrar todos los audios activos desde el inicio
            botonesAudio.forEach(button => {
                if (button.classList.contains('active')) {
                     const nombre = button.getAttribute('data-audio').split('/').pop();
                    if (nombre && !audiosEnGrabacion.includes(nombre)) {
                        audiosEnGrabacion.push(nombre);
                    }
                }
            });

            mediaRecorder = new MediaRecorder(mediaStreamDestinoGlobal.stream);
            mediaRecorder.ondataavailable = e => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                grabacionBlob = new Blob(chunks, { type: 'audio/webm' });
                botonDescargar.disabled = false;
            };

            mediaRecorder.start();
            grabando = true;
            botonGrabar.classList.add('activo');
            botonGrabar.querySelector('i').style.color = 'red';

        } else {
            mediaRecorder.stop();
            grabando = false;
            botonGrabar.classList.remove('activo');
            botonGrabar.querySelector('i').style.color = 'black';
        }
    });

    botonDescargar.addEventListener('click', async () => {
        if (!grabacionBlob) {
            alert("No hay grabación disponible para descargar.");
            return;
        }
    
        const arrayBuffer = await grabacionBlob.arrayBuffer();
        const audioBuffer = await contextoAudio.decodeAudioData(arrayBuffer);
        const wavBuffer = audioBufferToWav(audioBuffer);
        const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
    
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'grabacion_etnodj.wav';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Obtener la fecha y hora actuales
        const ahora = new Date();
        const fechaHora = ahora.toLocaleString('es-CO', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });

        // Crear y descargar el archivo de texto con los audios usados
        const contenidoFactura = `🧾 ETNODJ - FACTURA DE GRABACIÓN
        
Fecha: ${fechaHora}
Audios utilizados:

${audiosEnGrabacion.map((nombre, i) => `${i + 1}. ${nombre}`).join('\n')}
        
        Total: ${audiosEnGrabacion.length} audio(s)

Gracias por usar ETNODJ!
        `;

        // Crear un Blob y un enlace para descargar el archivo de texto
        const blobFactura = new Blob([contenidoFactura], { type: 'text/plain' });
        const urlFactura = URL.createObjectURL(blobFactura);
        const linkFactura = document.createElement('a');
        linkFactura.href = urlFactura;
        linkFactura.download = 'factura_etnodj.txt';
        document.body.appendChild(linkFactura);
        linkFactura.click();
        document.body.removeChild(linkFactura);
        URL.revokeObjectURL(urlFactura);

    });

    // Botones de silencio y solo
    document.querySelectorAll('.mute, .solo').forEach(btn => {
        btn.addEventListener('click', function() {
            if (!consolaEncendida) return;
            this.classList.toggle('activo');
            
            if (this.classList.contains('mute')) {
                const icono = this.querySelector('i');
                if (this.classList.contains('activo')) {
                    icono.classList.remove('fa-volume-high');
                    icono.classList.add('fa-volume-xmark');
                } else {
                    icono.classList.remove('fa-volume-xmark');
                    icono.classList.add('fa-volume-high');
                }
            }
            actualizarEstadoAudio();
        });
    });
});
