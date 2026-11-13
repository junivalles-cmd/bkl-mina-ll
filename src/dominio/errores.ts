/** Error que se muestra tal cual al usuario: una acción viola una regla del BKL. */
export class ReglaNegocioError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ReglaNegocioError';
  }
}
