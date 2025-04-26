document.addEventListener('DOMContentLoaded', function() {
    const botonesAudio = document.querySelectorAll('.selector');
    const contextoAudio = new (window.AudioContext || window.webkitAudioContext)();
    const masterGainNode = contextoAudio.createGain();
    masterGainNode.gain.setValueAtTime(1, contextoAudio.currentTime); // Volumen general al 100% inicialmente
    masterGainNode.connect(contextoAudio.destination);

    const fuentesAudio = {};
    const volumenesOriginales = {};
    let consolaEncendida = false; // Indica si la consola esta encendida o apagada
    let enPausa = false; // Indica si la consola esta en pausa cuando activo y en reproducción cuando no

    function cargarAudio(url) {
        return fetch(url)
            .then(response => response.arrayBuffer())
            .then(buffer => contextoAudio.decodeAudioData(buffer));
    }

    function reproducirAudio(audioBuffer) {
        const source = contextoAudio.createBufferSource();
        source.buffer = audioBuffer;
        source.loop = true;
        const gainNode = contextoAudio.createGain(); // Control de volumen
        source.connect(gainNode).connect(masterGainNode); // Conectar al masterGainNode 
        source.start();
        return { source, gainNode }; // Devolvemos source y gainNode
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
                    if (fuentesAudio[this.id].source) {
                        fuentesAudio[this.id].source.stop();
                        fuentesAudio[this.id].source = null;
                    }
                } else {
                    const section = this.dataset.section;
                    const seccionId = section.replace('volumen-', '');
                    const volumenOriginal = volumenesOriginales[section] ?? 0.5;
                    const debeSonar = seccionDebeSonar(seccionId);

                    const source = contextoAudio.createBufferSource();
                    source.buffer = fuentesAudio[this.id].buffer;
                    source.loop = true;

                    const gainNode = contextoAudio.createGain();

                    if (enPausa) {
                        // Iniciar en silencio y luego aplicar volumen si se puede
                        gainNode.gain.setValueAtTime(0, contextoAudio.currentTime);
                    } else {
                        gainNode.gain.setValueAtTime(debeSonar ? volumenOriginal : 0, contextoAudio.currentTime);
                    }
                    
                    // Luego conectamos
                    source.connect(gainNode).connect(masterGainNode);
                    source.start();

                    fuentesAudio[this.id].source = source;
                    fuentesAudio[this.id].gainNode = gainNode;
                    fuentesAudio[this.id].debeSonar = debeSonar;

                    if (grabando) {
                        gainNode.connect(mediaStreamDestinoGlobal);
                        const nombre = this.getAttribute('data-audio').split('/').pop();
                        audiosEnGrabacion.push(nombre);
                    }

                    this.classList.add('active');
                    this.dataset.active = 'true';
                }
                actualizarColorBoton(this);
                actualizarBotonesDeAudios();
            });
        });
    });
    
    // Evento para ajustar el volumen basado en el deslizador
    document.addEventListener('valuechange', (event) => {
        const { id, value } = event.detail;
        const gainValue = value / 100;

        if (!isFinite(gainValue)) return; // Verificar si gainValue es finito

        if (id === 'volumen') { 
            // Si es el control de volumen global
            masterGainNode.gain.setValueAtTime(gainValue, contextoAudio.currentTime);
        } else {
            // Volúmenes de las secciones individuales
            volumenesOriginales[id] = gainValue;

            Object.keys(fuentesAudio).forEach(key => {
                const btn = document.getElementById(key);
                if (!btn) return;
                if (btn.dataset.section === id) {
                    const fuente = fuentesAudio[key];
                    if (fuente.gainNode) {
                        const seccionId = id.replace('volumen-', '');
                        const debeSonar = seccionDebeSonar(seccionId);
                        fuente.gainNode.gain.setValueAtTime(debeSonar ? gainValue : 0, contextoAudio.currentTime);
                    }
                }
            });
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
            fuente.debeSonar = debeSonar; // Guardar el estado de si debe sonar o no
           
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
            botonEncender.classList.add('activo');
            botonEncender.querySelector('i').style.color = 'black';
            botonDetener.querySelector('i').classList.remove('fa-play');
            botonDetener.querySelector('i').classList.add('fa-pause');
            enPausa = false; // Asegurarse que no quede en pausa

        } else {
            botonEncender.classList.remove('activo');
            botonEncender.querySelector('i').style.color = 'red';
            botonDetener.querySelector('i').classList.remove('fa-pause');
            botonDetener.querySelector('i').classList.add('fa-play');
            enPausa = true; // Para evitar que se puedan activar sonidos por accidente

            // Detener todos los audios si la consola se apaga
            Object.keys(fuentesAudio).forEach(key => {
                if (fuentesAudio[key].source) {
                    fuentesAudio[key].source.stop();
                    fuentesAudio[key].source = null;
                }
            });

            // Desactivar todos los botones de audio, silencio y solo
            botonesAudio.forEach(button => {
                button.classList.remove('active','sonando');
                button.dataset.active = 'false';
                actualizarColorBoton(button);
            });
            botonesSilencio.forEach(button => {
                button.classList.remove('activo');
                const icono = button.querySelector('i');
                icono.classList.remove('fa-volume-xmark');
                icono.classList.add('fa-volume-high');
            });
            botonesSolo.forEach(button => {
                button.classList.remove('activo');
            });

            // Bajar el volumen general al 50%
            masterGainNode.gain.setValueAtTime(0.5, contextoAudio.currentTime);

            // Establecer todos los controles de volumen al 50% visual y funcional
            ['volumen-armonia', 'volumen-melodia', 'volumen-ritmo', 'volumen-fondo', 'volumen-adornos'].forEach(id => {
                const evento = new CustomEvent('valuechange', {
                    detail: {id: id, value: 50
                    }
                });
                document.dispatchEvent(evento);
                const deslizador = document.getElementById(id);
                if (deslizador && deslizador.__deslizadorCircular__) {
                    deslizador.__deslizadorCircular__.valor = 50;
                    deslizador.__deslizadorCircular__.dibujar();
                }
            });

            // Ectualizar el deslizador general 
            const deslizadorGeneral = document.getElementById('volumen');
            if (deslizadorGeneral && deslizadorGeneral.__deslizadorCircular__) {
                deslizadorGeneral.__deslizadorCircular__.valor = 50; 
                deslizadorGeneral.__deslizadorCircular__.dibujar();
            }
        }
    });

    botonDetener.addEventListener('click', () => {
        if (!consolaEncendida) return;
        enPausa = !enPausa;

        if (enPausa) {
            // Pausar todos los audios activos
            Object.keys(fuentesAudio).forEach(key => {
                const fuente = fuentesAudio[key];
                if (fuente.source) {
                    fuente.source.stop(); // Stop actual
                    fuente.source = null;
                }
                if (fuente.gainNode) {
                    fuente.gainNode.gain.setValueAtTime(0, contextoAudio.currentTime);
                }
            });
    
            // Cambiar ícono a "play"
            botonDetener.querySelector('i').classList.remove('fa-pause');
            botonDetener.querySelector('i').classList.add('fa-play');

        } else {
            // Reanudar todos los audios que estaban activos
            botonesAudio.forEach(button => {
                if (button.classList.contains('active')) {
                    const fuente = fuentesAudio[button.id];
                    const section = button.dataset.section;
                    const volumenOriginal = volumenesOriginales[section] ?? 0.5;

                    const buffer = fuente.buffer;
                    const { source, gainNode } = reproducirAudio(buffer);
                    fuente.source = source;
                    fuente.gainNode = gainNode;

                    const debeSonar = fuente.debeSonar ?? true;

                    gainNode.connect(masterGainNode);
                    gainNode.gain.setValueAtTime(debeSonar ? volumenOriginal : 0, contextoAudio.currentTime);

                    if (grabando) {
                        gainNode.connect(mediaStreamDestinoGlobal);
                    }
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
            // Registrar todos los audios activos desde el inicio
            botonesAudio.forEach(button => {
                if (button.classList.contains('active')) {
                    const section = button.dataset.section;
                    const seccionId = section.replace('volumen-', '');
                    const debeSonar = seccionDebeSonar(seccionId);
                    const fuente = fuentesAudio[button.id];

                    if (debeSonar && fuente && fuente.gainNode) {
                        fuente.gainNode.connect(mediaStreamDestinoGlobal);
                    }

                    // Añadir el nombre del audio a la factura
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
    const botonesSilencio = document.querySelectorAll('.mute');
    const botonesSolo = document.querySelectorAll('.solo');

    botonesSilencio.forEach(btn => {
        btn.addEventListener('click', function() {
            if (!consolaEncendida) return; // Si la consola está apagada, no hacer nada
            this.classList.toggle('activo');
            const icono = this.querySelector('i');

            if (this.classList.contains('activo')) {
                icono.classList.remove('fa-volume-high');
                icono.classList.add('fa-volume-xmark');
            } else {
                icono.classList.remove('fa-volume-xmark');
                icono.classList.add('fa-volume-high');
            }
            actualizarEstadoAudio();
        });
    });

    botonesSolo.forEach(btn => {
        btn.addEventListener('click', function() {
            if (!consolaEncendida) return; // Si la consola está apagada, no hacer nada
            this.classList.toggle('activo');
            actualizarEstadoAudio();
        });
    });

});