/**
 * Clase para crear un componente de deslizador horizontal interactivo.
 */
class DeslizadorHorizontal {
    /**
     * @param {HTMLElement} element El elemento contenedor para el deslizador.
     * @param {object} options Opciones de configuración.
     * @param {string} options.id Un ID único para el deslizador.
     * @param {number} [options.value=50] El valor inicial del deslizador (0-100).
     */
    constructor(element, options = {}) {
        this.elemento = element;
        this.valor = options.value !== undefined ? options.value : 50;
        this.id = options.id || '';
        this.arrastrando = false;

        this.inicializar();
        // Guardar una referencia a la instancia en el elemento DOM para acceso externo.
        this.elemento.__deslizadorHorizontal__ = this;
    }

    /**
     * Crea la estructura DOM del deslizador y adjunta los listeners de eventos.
     */
    inicializar() {
        this.elemento.classList.add('deslizador-horizontal-js');

        // Crear los elementos visuales del deslizador
        this.track = document.createElement('div');
        this.track.classList.add('track');

        this.fill = document.createElement('div');
        this.fill.classList.add('fill');

        this.thumb = document.createElement('div');
        this.thumb.classList.add('thumb');

        this.elemento.appendChild(this.track);
        this.elemento.appendChild(this.fill);
        this.elemento.appendChild(this.thumb);

        // Listeners para eventos de ratón
        this.elemento.addEventListener('mousedown', this.iniciarArrastre.bind(this));
        window.addEventListener('mousemove', this.arrastrar.bind(this));
        window.addEventListener('mouseup', this.detenerArrastre.bind(this));

        // Listeners para eventos táctiles (para dispositivos móviles)
        this.elemento.addEventListener('touchstart', this.iniciarArrastre.bind(this), { passive: false });
        window.addEventListener('touchmove', this.arrastrar.bind(this), { passive: false });
        window.addEventListener('touchend', this.detenerArrastre.bind(this));

        this.dibujar();
        this.emitirCambioValor(); // Emitir valor inicial
    }

    /**
     * Se activa al presionar el ratón o tocar la pantalla.
     * @param {MouseEvent|TouchEvent} event El evento del navegador.
     */
    iniciarArrastre(event) {
        event.preventDefault();
        this.arrastrando = true;
        this.actualizarValor(event);
    }

    /**
     * Se activa al mover el ratón o el dedo por la pantalla.
     * @param {MouseEvent|TouchEvent} event El evento del navegador.
     */
    arrastrar(event) {
        if (this.arrastrando) {
            event.preventDefault();
            this.actualizarValor(event);
        }
    }

    /**
     * Se activa al soltar el ratón o levantar el dedo de la pantalla.
     */
    detenerArrastre() {
        if (this.arrastrando) {
            this.arrastrando = false;
        }
    }

    /**
     * Calcula y actualiza el valor del deslizador basado en la posición del puntero.
     * @param {MouseEvent|TouchEvent} event El evento del navegador.
     */
    actualizarValor(event) {
        const rect = this.track.getBoundingClientRect();
        // Usar `touches` si es un evento táctil, si no, usar el evento de ratón.
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;

        let posX = clientX - rect.left;
        let porcentaje = (posX / rect.width) * 100;

        // Limitar el valor entre 0 y 100.
        this.valor = Math.max(0, Math.min(100, porcentaje));

        this.dibujar();
        this.emitirCambioValor();
    }

    /**
     * Emite un evento personalizado 'valuechange' para que otros scripts puedan reaccionar.
     */
    emitirCambioValor() {
        if (!isFinite(this.valor)) return;
        const event = new CustomEvent('valuechange', {
            detail: {
                id: this.id,
                value: this.valor
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * Actualiza la posición del thumb y el ancho del relleno para reflejar el valor actual.
     */
    dibujar() {
        const porcentaje = this.valor;
        this.fill.style.width = `${porcentaje}%`;
        // La posición del thumb se calcula como un porcentaje. Restamos la mitad de su ancho para centrarlo.
        this.thumb.style.left = `calc(${porcentaje}% - 6px)`;
    }
}
