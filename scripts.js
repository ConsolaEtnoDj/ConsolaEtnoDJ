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

    function actualizarVisualizador() {
        while (visualizador.firstChild) {
            visualizador.removeChild(visualizador.firstChild);
        }

        const audiosSeleccionados = document.querySelectorAll('.selector.active');
        
        if (audiosSeleccionados.length === 0) {
            const img = document.createElement('img');
            img.src = '/Imagenes/etno-dj.png';
            img.alt = 'Visualizador EtnoDJ';
            img.style.maxWidth = '80%';
            img.style.maxHeight = '80%';
            img.style.borderRadius = '12px';
            img.style.margin = 'auto';
            visualizador.appendChild(img);
            return;
        }

        const categorias = ['armonia', 'melodia', 'ritmo', 'fondo', 'adornos'];
        audiosSeleccionados.forEach(boton => {
            const nombreAudio = boton.getAttribute('data-tooltip');
            if (nombreAudio) {
                const itemAudio = document.createElement('div');
                itemAudio.className = 'visualizador-item';
                itemAudio.textContent = nombreAudio;
                
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
            const seccionId = section.replace('volumen-', '');
            const debeSonar = seccionDebeSonar(seccionId);
            button.classList.toggle('sonando', button.classList.contains('active') && debeSonar && !enPausa);
        });
    }

    botonesAudio.forEach((button) => {
        button.dataset.active = 'false';
        const audioUrl = button.getAttribute('data-audio');
        const sectionId = button.closest('.fila').dataset.section;
        button.setAttribute('data-section', sectionId);
        
        if (audioUrl) {
            const nombreArchivo = audioUrl.split('/').pop().replace(/\.[^/.]+$/, "").replace(/_/g, ' '); 
            const nombreFormateado = nombreArchivo.charAt(0).toUpperCase() + nombreArchivo.slice(1);
            button.setAttribute('data-tooltip', nombreFormateado);
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

            // CORRECCIÓN: Se reestructura el manejador de clic para mayor robustez.
            button.addEventListener('click', function() {
                if (!consolaEncendida) return;

                // 1. Alterna el estado visual del botón.
                this.classList.toggle('active');
                
                // 2. Actualiza la lista del visualizador inmediatamente.
                actualizarVisualizador();
                
                const isActive = this.classList.contains('active');

                // 3. Maneja la lógica de audio.
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

                // 4. Actualiza el estado 'sonando' de todos los botones.
                actualizarBotonesDeAudios();
            });
        });
    });
    
    actualizarVisualizador();

    document.addEventListener('valuechange', (event) => {
        const { id, value } = event.detail;
        const gainValue = value / 100;
        if (!isFinite(gainValue)) return;
        masterGainNode.gain.setValueAtTime(gainValue, contextoAudio.currentTime);
    });

    document.querySelectorAll('.deslizador-vertical').forEach(slider => {
        const initialPercentage = slider.value;
        slider.style.setProperty('--fill-percentage', `${initialPercentage}%`);
        slider.addEventListener('input', (event) => {
            const id = event.target.id;
            const value = parseFloat(event.target.value);
            const gainValue = value / 100;
            event.target.style.setProperty('--fill-percentage', `${value}%`);
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
             document.querySelectorAll('.deslizador-vertical').forEach(s => {
                s.value = 50;
                s.style.setProperty('--fill-percentage', '50%');
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
            Object.values(fuentesAudio).forEach(fuente => {
                if (fuente.gainNode && fuente.source) {
                     fuente.gainNode.connect(mediaStreamDestinoGlobal);
                }
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
