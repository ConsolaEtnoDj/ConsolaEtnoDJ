document.addEventListener('DOMContentLoaded', function() {
    const botonesAudio = document.querySelectorAll('.selector');
    const contextoAudio = new (window.AudioContext || window.webkitAudioContext)();
    
    // Establecer el contexto de audio para que Tone.js lo utilice
    Tone.setContext(contextoAudio);

    // Nodo de ganancia maestro (nativo, ya que se conecta al destino final)
    const masterGainNode = contextoAudio.createGain();
    masterGainNode.gain.setValueAtTime(1, contextoAudio.currentTime);
    masterGainNode.connect(contextoAudio.destination);

    const fuentesAudio = {};
    const volumenesOriginales = {};
    let tonosOriginales = {}; // Almacena los valores de tono en semitonos
    let consolaEncendida = false;
    let enPausa = false;

    /**
     * Carga un archivo de audio y devuelve una promesa que se resuelve con un Tone.Buffer.
     * @param {string} url - La URL del archivo de audio.
     * @returns {Promise<Tone.Buffer>}
     */
    function cargarAudio(url) {
        return new Promise((resolve, reject) => {
            const buffer = new Tone.Buffer(url, () => resolve(buffer), (err) => reject(err));
        });
    }

    /**
     * Inicia una fuente de audio para un botón específico usando Tone.js.
     * Crea Tone.Player, Tone.PitchShift y Tone.Gain y los encadena.
     * @param {HTMLElement} button - El botón del selector que se está activando.
     */
    function iniciarFuenteAudio(button) {
        const id = button.id;
        if (!fuentesAudio[id] || !fuentesAudio[id].buffer) return;

        const section = button.dataset.section;
        const seccionIdVolumen = section;
        const seccionIdTono = section.replace('volumen-', 'tono-');

        const volumenOriginal = volumenesOriginales[seccionIdVolumen] ?? 0.5;
        const tonoOriginal = tonosOriginales[seccionIdTono] ?? 0;
        const debeSonar = seccionDebeSonar(section.replace('volumen-', ''));

        // Crear nodos de Tone.js
        const player = new Tone.Player(fuentesAudio[id].buffer).set({ loop: true });
        const pitchShiftNode = new Tone.PitchShift({ pitch: tonoOriginal });
        const gainNode = new Tone.Gain(debeSonar ? volumenOriginal : 0);

        // Conectar la cadena de audio usando el método chain de Tone.js
        player.chain(pitchShiftNode, gainNode, masterGainNode);
        
        player.start();

        // Almacenar nodos y estado
        fuentesAudio[id].source = player;
        fuentesAudio[id].gainNode = gainNode;
        fuentesAudio[id].pitchShiftNode = pitchShiftNode;
        fuentesAudio[id].debeSonar = debeSonar;

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
            button.classList.toggle('sonando', button.classList.contains('active') && debeSonar);
        });
    }    

    function actualizarColorBoton(button){
        button.style.opacity = button.classList.contains('active') ? "1" : "0.5";
    }

    botonesAudio.forEach((button) => {
        button.dataset.active = 'false';
        const audioUrl = button.getAttribute('data-audio');
        if (!audioUrl) return;
        const sectionId = button.closest('.fila').dataset.section;
        button.setAttribute('data-section', sectionId);
        button.style.opacity = "0.5";
    
        cargarAudio(audioUrl).then(toneBuffer => {
            fuentesAudio[button.id] = {
                buffer: toneBuffer,
                source: null,
                gainNode: null,
                pitchShiftNode: null
            };
    
            button.addEventListener('click', function() {
                if (!consolaEncendida) return;
    
                if (this.classList.contains('active')) {
                    this.classList.remove('active');
                    this.dataset.active = 'false';
                    const { source, gainNode, pitchShiftNode } = fuentesAudio[this.id];
                    if (source) source.dispose();
                    if (gainNode) gainNode.dispose();
                    if (pitchShiftNode) pitchShiftNode.dispose();
                    fuentesAudio[this.id].source = null;
                    fuentesAudio[this.id].gainNode = null;
                    fuentesAudio[this.id].pitchShiftNode = null;

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
    
    document.addEventListener('valuechange', (event) => {
        const { id, value } = event.detail;

        if (id === 'volumen') { 
            const gainValue = value / 100;
            if (!isFinite(gainValue)) return;
            masterGainNode.gain.setTargetAtTime(gainValue, contextoAudio.currentTime, 0.05);
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
                        fuente.gainNode.gain.rampTo(debeSonar ? gainValue : 0, 0.05);
                    }
                }
            });
        } else if (id.startsWith('tono-')) {
            const totalSteps = 24;
            const semitones = Math.round((value / 100) * totalSteps) - 12;

            if (!isFinite(semitones)) return;

            tonosOriginales[id] = semitones;
            const sectionId = id.replace('tono-', 'volumen-');

            Object.keys(fuentesAudio).forEach(key => {
                const btn = document.getElementById(key);
                if (!btn) return;
                if (btn.dataset.section === sectionId) {
                    const fuente = fuentesAudio[key];
                    if (fuente && fuente.pitchShiftNode) {
                        fuente.pitchShiftNode.pitch = semitones;
                    }
                }
            });
            const displayId = `valor-${id}`;
            const displayElement = document.getElementById(displayId);
            if (displayElement) {
                displayElement.textContent = semitones > 0 ? `+${semitones}` : `${semitones}`;
            }
        }
    });

    function actualizarEstadoAudio() {
        botonesAudio.forEach(button => {
            if (!button.classList.contains('active')) return;

            const section = button.dataset.section;
            const seccionId = section.replace('volumen-', '');
            const debeSonar = seccionDebeSonar(seccionId);
            const fuente = fuentesAudio[button.id];
            const volumenOriginal = volumenesOriginales[section] ?? 0.5;

            if (fuente && fuente.gainNode) {
                if (!enPausa) {
                    fuente.gainNode.gain.rampTo(debeSonar ? volumenOriginal : 0, 0.05);
                } 
            }
            if (fuente) {
                fuente.debeSonar = debeSonar;
            }
            actualizarColorBoton(button);
        });
        actualizarBotonesDeAudios();
    }
   
    const botonEncender = document.getElementById('encender');
    const botonDetener = document.getElementById('detener');
    const botonGrabar = document.getElementById('grabar');
    const botonDescargar = document.getElementById('descargar');
    
    botonEncender.querySelector('i').style.color = 'red';

    botonEncender.addEventListener('click', function() {
        consolaEncendida = !consolaEncendida;
        if (consolaEncendida) {
            if (contextoAudio.state === 'suspended') {
                contextoAudio.resume();
            }
            botonEncender.classList.add('activo');
            botonEncender.querySelector('i').style.color = 'black';
            botonDetener.querySelector('i').classList.replace('fa-play', 'fa-pause');
            enPausa = false; 

        } else {
            botonEncender.classList.remove('activo');
            botonEncender.querySelector('i').style.color = 'red';
            botonDetener.querySelector('i').classList.replace('fa-pause', 'fa-play');
            enPausa = true; 

            Object.keys(fuentesAudio).forEach(key => {
                const { source, gainNode, pitchShiftNode } = fuentesAudio[key];
                if (source) source.dispose();
                if (gainNode) gainNode.dispose();
                if (pitchShiftNode) pitchShiftNode.dispose();
                fuentesAudio[key].source = null;
                fuentesAudio[key].gainNode = null;
                fuentesAudio[key].pitchShiftNode = null;
            });

            botonesAudio.forEach(button => {
                button.classList.remove('active','sonando');
                button.dataset.active = 'false';
                actualizarColorBoton(button);
            });
            document.querySelectorAll('.mute, .solo').forEach(button => {
                button.classList.remove('activo');
                if (button.classList.contains('mute')) {
                    button.querySelector('i').classList.replace('fa-volume-xmark', 'fa-volume-high');
                }
            });

            ['volumen', 'volumen-armonia', 'volumen-melodia', 'volumen-ritmo', 'volumen-fondo', 'volumen-adornos'].forEach(id => {
                const deslizador = document.getElementById(id)?.__deslizadorCircular__;
                if (deslizador) {
                    deslizador.valor = 50;
                    deslizador.dibujar();
                    document.dispatchEvent(new CustomEvent('valuechange', { detail: {id: id, value: 50 } }));
                }
            });
            
            ['tono-armonia', 'tono-melodia', 'tono-ritmo', 'tono-fondo', 'tono-adornos'].forEach(id => {
                 const deslizador = document.getElementById(id)?.__deslizadorCircular__;
                if (deslizador) {
                    deslizador.valor = 50;
                    deslizador.dibujar();
                    document.dispatchEvent(new CustomEvent('valuechange', { detail: {id: id, value: 50 } }));
                }
                const displayElement = document.getElementById(`valor-${id}`);
                if (displayElement) displayElement.textContent = '0';
            });
            tonosOriginales = {};
            volumenesOriginales = {};
        }
    });

    botonDetener.addEventListener('click', () => {
        if (!consolaEncendida) return;
        enPausa = !enPausa;
        botonDetener.querySelector('i').classList.toggle('fa-play', enPausa);
        botonDetener.querySelector('i').classList.toggle('fa-pause', !enPausa);

        if (enPausa) {
            Object.values(fuentesAudio).forEach(fuente => {
                if (fuente.source) {
                    fuente.source.stop();
                }
            });
        } else {
            botonesAudio.forEach(button => {
                if (button.classList.contains('active')) {
                    const { source, gainNode, pitchShiftNode } = fuentesAudio[button.id];
                    if (source) source.dispose();
                    if (gainNode) gainNode.dispose();
                    if (pitchShiftNode) pitchShiftNode.dispose();
                    iniciarFuenteAudio(button);
                }
            });
        }
    });    

    let mediaRecorder;
    let grabando = false;
    let chunks = [];
    let audiosEnGrabacion = [];
    let grabacionBlob = null;
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
            
            botonesAudio.forEach(button => {
                if (button.classList.contains('active')) {
                    const nombre = button.getAttribute('data-audio').split('/').pop();
                    if (nombre && !audiosEnGrabacion.includes(nombre)) audiosEnGrabacion.push(nombre);
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
        if (!grabacionBlob) return;
    
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

        const ahora = new Date();
        const fechaHora = ahora.toLocaleString('es-CO', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        });

        const contenidoFactura = `🧾 ETNODJ - FACTURA DE GRABACIÓN\n\nFecha: ${fechaHora}\nAudios utilizados:\n\n${audiosEnGrabacion.map((nombre, i) => `${i + 1}. ${nombre}`).join('\n')}\n\nTotal: ${audiosEnGrabacion.length} audio(s)\n\nGracias por usar ETNODJ!`;

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

    document.querySelectorAll('.mute, .solo').forEach(btn => {
        btn.addEventListener('click', function() {
            if (!consolaEncendida) return;
            this.classList.toggle('activo');
            if (this.classList.contains('mute')) {
                this.querySelector('i').classList.toggle('fa-volume-high', !this.classList.contains('activo'));
                this.querySelector('i').classList.toggle('fa-volume-xmark', this.classList.contains('activo'));
            }
            actualizarEstadoAudio();
        });
    });
});
