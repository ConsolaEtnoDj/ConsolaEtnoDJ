document.addEventListener('DOMContentLoaded', function() {
    const botonesAudio = document.querySelectorAll('.selector');
    const contextoAudio = new (window.AudioContext || window.webkitAudioContext)();
    const masterGainNode = contextoAudio.createGain();
    masterGainNode.connect(contextoAudio.destination);

    const fuentesAudio = {};
    const volumenesOriginales = {};
    let consolaEncendida = false;
    let enPausa = false;

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

    function actualizarColorBoton(button) {
        button.classList.toggle('active', button.dataset.active === 'true');
    }

    botonesAudio.forEach((button) => {
        button.dataset.active = 'false';
        const audioUrl = button.getAttribute('data-audio');
        const sectionId = button.closest('.fila').dataset.section;
        button.setAttribute('data-section', sectionId);

        cargarAudio(audioUrl).then(audioBuffer => {
            if (!audioBuffer) return;
            fuentesAudio[button.id] = { buffer: audioBuffer, source: null, gainNode: null };

            button.addEventListener('click', function() {
                if (!consolaEncendida) return;

                const isActive = this.classList.toggle('active');
                this.dataset.active = isActive;

                if (isActive) {
                    const section = this.dataset.section;
                    const seccionId = section.replace('volumen-', '');
                    const volumenOriginal = volumenesOriginales[section] ?? 0.5;
                    const debeSonar = seccionDebeSonar(seccionId);

                    const { source, gainNode } = reproducirAudio(fuentesAudio[this.id].buffer);
                    fuentesAudio[this.id] = { ...fuentesAudio[this.id], source, gainNode };
                    
                    gainNode.gain.setValueAtTime(debeSonar && !enPausa ? volumenOriginal : 0, contextoAudio.currentTime);
                    
                    if (grabando) {
                        gainNode.connect(mediaStreamDestinoGlobal);
                        const nombre = this.getAttribute('data-audio').split('/').pop();
                        audiosEnGrabacion.push(nombre);
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

    document.addEventListener('valuechange', (event) => {
        const { id, value } = event.detail;
        const gainValue = value / 100;
        if (!isFinite(gainValue)) return;
        masterGainNode.gain.setValueAtTime(gainValue, contextoAudio.currentTime);
    });

    document.querySelectorAll('.deslizador-vertical').forEach(slider => {
        slider.addEventListener('input', (event) => {
            const id = event.target.id;
            const value = parseFloat(event.target.value);
            const gainValue = value / 100;

            if (!isFinite(gainValue)) return;
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
        });
    });

    function actualizarEstadoAudio() {
        Object.keys(fuentesAudio).forEach(key => {
            const fuente = fuentesAudio[key];
            const btn = document.getElementById(key);
            if(fuente.gainNode && btn){
                 const sectionId = btn.dataset.section.replace('volumen-', '');
                 const debeSonar = seccionDebeSonar(sectionId);
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
             document.querySelectorAll('.deslizador-vertical').forEach(s => s.value = 50);
             const volGeneral = document.getElementById('volumen').__deslizadorCircular__;
             if(volGeneral) {
                volGeneral.valor = 100;
                volGeneral.dibujar();
                volGeneral.emitirCambioValor();
             }
        }
        botonDetener.querySelector('i').className = `fa-solid ${consolaEncendida && !enPausa ? 'fa-pause' : 'fa-play'}`;
        actualizarBotonesDeAudios();
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

    let mediaRecorder, grabando = false, chunks = [], audiosEnGrabacion = [], grabacionBlob = null;
    const mediaStreamDestinoGlobal = contextoAudio.createMediaStreamDestination();

    botonGrabar.addEventListener('click', () => {
        if (!consolaEncendida) return;
        grabando = !grabando;
        botonGrabar.classList.toggle('activo', grabando);
        if (grabando) {
            chunks = [];
            audiosEnGrabacion = [];
            Object.values(fuentesAudio).forEach(fuente => {
                if (fuente.gainNode) fuente.gainNode.connect(mediaStreamDestinoGlobal);
            });
            mediaRecorder = new MediaRecorder(mediaStreamDestinoGlobal.stream);
            mediaRecorder.ondataavailable = e => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                grabacionBlob = new Blob(chunks, { type: 'audio/webm' });
                botonDescargar.disabled = false;
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
