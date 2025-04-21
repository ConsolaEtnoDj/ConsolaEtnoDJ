document.addEventListener('DOMContentLoaded', function() {
    const botonesAudio = document.querySelectorAll('.selector');
    const contextoAudio = new (window.AudioContext || window.webkitAudioContext)();
    const fuentesAudio = {};
    const volumenesOriginales = {};
    let consolaEncendida = false;

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
        source.connect(gainNode).connect(contextoAudio.destination);
        source.start();
        return { source, gainNode }; // Devolvemos source y gainNode
    }

    function seccionDebeSonar(sectionId) {
        const muteBtn = document.getElementById(`mute-${sectionId}`);
        const soloBtn = document.getElementById(`solo-${sectionId}`);
        const haySoloActivo = Array.from(document.querySelectorAll('.solo')).some(b => b.classList.contains('activo'));
        const estaEnSolo = soloBtn && soloBtn.classList.contains('activo');
        const estaMuteada = muteBtn && muteBtn.classList.contains('activo');

        if (!estaMuteada) return true;
        if (!estaMuteada && estaEnSolo) return true;
        if (!estaMuteada && !haySoloActivo) return true

        return false;
    }

    function actualizarColorBoton(button){
        if (button.classList.contains('active')) {
            button.style.opacity = "1"; // Opacidad completa cuando está activo
        } else {
            button.style.opacity = "0.5"; // Opacidad al 50% cuando está inactivo
        }
    }

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
                    fuentesAudio[this.id].source.stop();
                    fuentesAudio[this.id].source = null;
                } else {
                    const { source, gainNode } = reproducirAudio(fuentesAudio[this.id].buffer);
                    fuentesAudio[this.id].source = source;
                    fuentesAudio[this.id].gainNode = gainNode;
                    gainNode.connect(contextoAudio.destination);
                    if (grabando) {
                        gainNode.connect(mediaStreamDestinoGlobal);
                        const nombre = this.getAttribute('data-audio').split('/').pop();
                        audiosEnGrabacion.push(nombre);
                    }
                    this.classList.add('active');
                    this.dataset.active = 'true';
    
                    const section = this.dataset.section;
                    const seccionId = section.replace('volumen-', '');
                    const volumenOriginal = volumenesOriginales[section] ?? 0.5;
                    
                    // Iniciar en silencio y luego aplicar volumen si se puede
                    gainNode.gain.setValueAtTime(0, contextoAudio.currentTime);

                    setTimeout(() => {
                        const debeSonar = seccionDebeSonar(seccionId);
                        gainNode.gain.setValueAtTime(debeSonar ? volumenOriginal : 0, contextoAudio.currentTime);
                    }, 0);
                    }
        
                actualizarColorBoton(this);
            });
        });
    });
    
    // Evento para ajustar el volumen basado en el deslizador
    document.addEventListener('valuechange', (event) => {
        const { id, value } = event.detail;
        const gainValue = value / 100;
        if (!isFinite(gainValue)) return; // Verificar si gainValue es finito

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
    });

    // Función para actualizar el estado de los botones de silencio y solo
    function actualizarEstadoAudio() {
        const botonesSilencio = document.querySelectorAll('.mute');
        const botonesSolo = document.querySelectorAll('.solo');
        const seccionesActivas = Array.from(botonesSolo).filter(btn => btn.classList.contains('activo')).map(btn => btn.id.replace('solo-', ''));

        botonesSilencio.forEach(btn => {
            const sectionId = btn.id.replace('mute-', '');
            const gainNodes = Array.from(document.querySelectorAll(`.selector[data-section="volumen-${sectionId}"]`)).map(selector => fuentesAudio[selector.id]?.gainNode);
            const volumenOriginal = volumenesOriginales[`volumen-${sectionId}`] ?? 0.5;

            if (btn.classList.contains('activo')) {
                gainNodes.forEach(gainNode => {
                    if (gainNode) gainNode.gain.setValueAtTime(0, contextoAudio.currentTime);
                });
            } else if (seccionesActivas.length > 0 && !seccionesActivas.includes(sectionId)) {
                gainNodes.forEach(gainNode => {
                    if (gainNode) gainNode.gain.setValueAtTime(0, contextoAudio.currentTime);
                });
            } else {
                gainNodes.forEach(gainNode => {
                    if (gainNode) gainNode.gain.setValueAtTime(volumenOriginal, contextoAudio.currentTime);
                });
            }
        });
    }

    // Agregar funcionalidad a los botones de silencio y solo
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

   
    const botonEncender = document.getElementById('encender');
    const botonDetener = document.getElementById('detener');
    const botonGrabar = document.getElementById('grabar');
    const botonDescargar = document.getElementById('descargar');

    let enPausa = false;
    
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

            // Desactivar todos los botones de audio
            botonesAudio.forEach(button => {
                button.classList.remove('active');
                button.dataset.active = 'false';
                actualizarColorBoton(button);
            });
            // Desactivar todos los botones de silencio y solo
            botonesSilencio.forEach(button => {
                button.classList.remove('activo');
                const icono = button.querySelector('i');
                icono.classList.remove('fa-volume-xmark');
                icono.classList.add('fa-volume-high');
            });
            botonesSolo.forEach(button => {
                button.classList.remove('activo');
            });

            // Establecer todos los controles de volumen al 50% visual y funcional
            const volumenIds = [
                'volumen-armonia',
                'volumen-melodia',
                'volumen-ritmo',
                'volumen-fondo',
                'volumen-adornos'
            ];
            
            volumenIds.forEach(id => {
                const evento = new CustomEvent('valuechange', {
                    detail: {
                        id: id,
                        value: 50
                    }
                });
                document.dispatchEvent(evento);
                const deslizador = document.getElementById(id);
                if (deslizador && deslizador.__deslizadorCircular__) {
                    deslizador.__deslizadorCircular__.valor = 50;
                    deslizador.__deslizadorCircular__.dibujar();
                }
            });
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

Gracias Por usar ETNODJ!
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
                    const buffer = fuentesAudio[button.id].buffer;
                    const section = button.dataset.section;
                    const seccionId = section.replace('volumen-', '');
                    const debeSonar = seccionDebeSonar(seccionId);
            
                    const { source, gainNode } = reproducirAudio(buffer);
                    fuentesAudio[button.id].source = source;
                    fuentesAudio[button.id].gainNode = gainNode;
            
                    const volumenOriginal = volumenesOriginales[section] ?? 0.5;
                    gainNode.gain.setValueAtTime(debeSonar ? volumenOriginal : 0, contextoAudio.currentTime);
            
                    if (grabando) {
                        gainNode.connect(mediaStreamDestinoGlobal);
                    }
            
                    gainNode.connect(contextoAudio.destination);
                }
            });
    
            // Cambiar ícono a "pausa"
            botonDetener.querySelector('i').classList.remove('fa-play');
            botonDetener.querySelector('i').classList.add('fa-pause');
        }
    });    
    
});