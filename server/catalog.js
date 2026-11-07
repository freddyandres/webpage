'use strict';
/** Catálogos compartidos entre el formulario público y el panel. */

const CATEGORIES = [
  { value: 'accesorios', label: 'Accesorios para mascotas' },
  { value: 'ropa', label: 'Ropa para perros y gatos' },
  { value: 'juguetes', label: 'Juguetes' },
  { value: 'camitas', label: 'Camitas y mantas' },
  { value: 'snacks', label: 'Snacks y repostería para mascotas' },
  { value: 'higiene', label: 'Productos de higiene' },
  { value: 'placas', label: 'Placas personalizadas' },
  { value: 'retratos', label: 'Retratos y fotografías' },
  { value: 'otros', label: 'Otros productos relacionados con los animales' },
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

module.exports = { CATEGORIES, SPACE_OPTIONS, STATUSES, labelOf };
