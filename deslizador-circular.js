class DeslizadorCircular {
    constructor(element, options = {}) {
        this.elemento = element;
        this.radio = options.radius || 35; // Radio del círculo
        this.valor = options.value !== undefined ? options.value : 0; // Valor inicial
        this.id = options.id || '';

        this.inicializar();
        this.elemento.__deslizadorCircular__ = this; // Guardar instancia en el DOM
    }

    inicializar() {
        this.circuloExterior = document.createElement('div');
        this.circuloExterior.classList.add('circulo-exterior');

        this.circuloInterior = document.createElement('div');
        this.circuloInterior.classList.add('circulo-interior');

        this.indicador = document.createElement('div');
        this.indicador.classList.add('indicador');

        this.circuloExterior.appendChild(this.circuloInterior);
        this.circuloExterior.appendChild(this.indicador);
        this.elemento.appendChild(this.circuloExterior);

        this.arrastrando = false;

        const iniciarArrastre = (event) => {
            event.preventDefault();
            this.arrastrando = true;
            this.actualizarValor(event.type.includes('touch') ? event.touches[0] : event);
        };

        const arrastrar = (event) => {
            if (this.arrastrando) {
                event.preventDefault();
                this.actualizarValor(event.type.includes('touch') ? event.touches[0] : event);
            }
        };

        const detenerArrastre = () => {
            this.arrastrando = false;
        };

        this.elemento.addEventListener('mousedown', iniciarArrastre);
        window.addEventListener('mousemove', arrastrar);
        window.addEventListener('mouseup', detenerArrastre);

        this.elemento.addEventListener('touchstart', iniciarArrastre);
        window.addEventListener('touchmove', arrastrar);
        window.addEventListener('touchend', detenerArrastre);


        this.dibujar();
        this.emitirCambioValor(); // Emitir evento al inicializar
    }

    actualizarValor(event) {
        const rect = this.circuloExterior.getBoundingClientRect();
        const centroX = rect.left + rect.width / 2;
        const centroY = rect.top + rect.height / 2;
        const x = event.clientX - centroX;
        const y = event.clientY - centroY;
        let angulo = Math.atan2(y, x) + Math.PI / 2;

        if (angulo < 0) {
            angulo += 2 * Math.PI;
        }

        this.valor = (angulo / (2 * Math.PI)) * 100;
        
        this.dibujar();
        this.emitirCambioValor();
    }

    emitirCambioValor() {
        if (!isFinite(this.valor)) return;
        const event = new CustomEvent('valuechange', {
            detail: {
                id: this.id,
                value: this.valor
            }
        });
        this.elemento.dispatchEvent(event);
    }

    dibujar() {
        const angulo = (this.valor / 100) * 2 * Math.PI;
        this.indicador.style.transform = `translateX(-50%) rotate(${angulo}rad)`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const deslizadores = document.querySelectorAll('.deslizador-circular');
    deslizadores.forEach(deslizador => {
        new DeslizadorCircular(deslizador, { value: 100, id: deslizador.id });
    });
});
