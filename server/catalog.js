'use strict';
/** Catálogos compartidos entre el formulario público y el panel. */

const CATEGORIES = [
  { value: 'ropa', label: 'Ropa, calzado y accesorios' },
  { value: 'comida', label: 'Comida, postres y bebidas' },
  { value: 'belleza', label: 'Belleza y cuidado personal' },
  { value: 'artesanias', label: 'Artesanías y manualidades' },
  { value: 'hogar', label: 'Hogar y decoración' },
  { value: 'mascotas', label: 'Productos para mascotas' },
  { value: 'tecnologia', label: 'Tecnología y accesorios' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'otros', label: 'Otro tipo de emprendimiento' },
];

/** Categorías anteriores: ya no se ofrecen, pero se siguen mostrando bien en inscripciones antiguas. */
const LEGACY_CATEGORIES = [
  { value: 'accesorios', label: 'Accesorios para mascotas' },
  { value: 'juguetes', label: 'Juguetes' },
  { value: 'camitas', label: 'Camitas y mantas' },
  { value: 'snacks', label: 'Snacks y repostería para mascotas' },
  { value: 'higiene', label: 'Productos de higiene' },
  { value: 'placas', label: 'Placas personalizadas' },
  { value: 'retratos', label: 'Retratos y fotografías' },
];

const SPACE_OPTIONS = [
  { value: 'una_mesa', label: 'El espacio de una mesa' },
  { value: 'dos_mesas', label: 'El espacio de dos mesas' },
  { value: 'pequeno', label: 'Un espacio pequeño (sin mesa)' },
  { value: 'otro', label: 'Otro (lo explico en la solicitud especial)' },
];

const STATUSES = [
  { value: 'pendiente', label: 'Pendiente de revisión' },
  { value: 'aprobada', label: 'Aprobada' },
  { value: 'rechazada', label: 'Rechazada' },
];

const labelOf = (list, value) => (list.find((o) => o.value === value) || {}).label || value;

module.exports = { CATEGORIES, LEGACY_CATEGORIES, SPACE_OPTIONS, STATUSES, labelOf };
