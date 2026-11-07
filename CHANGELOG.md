# Historial de cambios

## Sin publicar — Asistencia, permisos de cajero y planillas

- Nuevo alcance restringido para cajeros: solo ven y operan `Mesas`, `Egresos` y `Cierre`.
- La API exige rol de administrador para historial, asistencia global, detalle de turnos, apertura de caja, ventas de barra y anulaciones.
- El cajero recibe una vista sanitizada del turno: solo sus propios egresos y su propia asistencia; no ve ventas, partidas, pagos QR, resúmenes, arqueo ni auditoría.
- Cierre de caja del cajero con arqueo ciego y sin exigir observaciones por diferencia; el administrador conserva el detalle completo y la exigencia de explicar diferencias.
- La venta rápida de barra y la apertura de caja quedan reservadas al administrador; el cajero ve un aviso de espera si la caja está cerrada.
- Nuevas pestañas `Egresos` y `Cierre` para cajeros, con listado de egresos propios y confirmación de salida sin totales.
- Registro automático de entrada del personal al iniciar sesión con PIN.
- Registro de salida al confirmar el arqueo y cerrar la caja.
- Nueva sección `Ajustes > Personal` con entradas, salidas, duración, búsqueda y filtro de jornadas sin salida.
- Avisos de entrada/salida en Caja, en el cierre de turno y en el diálogo de caja cerrada.
- La entrada, la salida y la duración de cada persona también aparecen en el detalle del turno y en la planilla imprimible.
- Planilla de asistencia imprimible desde `Ajustes > Personal`, con resumen por persona, detalle de entradas y salidas y filtros aplicados; se puede guardar como PDF desde el diálogo de impresión.
- Acceso directo `Billar & Bar` en el escritorio, con icono propio.
- Lanzador `desktop\BillarBar.exe`: inicia el servidor local sin ventana si hace falta y abre el sistema en una ventana de aplicación sin barra de navegador.
- `iniciar.bat` queda como método de respaldo y diagnóstico.
- Gastos de caja con detalle de productos comprados: cantidad, costo unitario y subtotal por línea.
- El monto del gasto se calcula automáticamente en el servidor cuando se cargan productos.
- Nueva planilla imprimible de gastos con resumen por categoría, detalle de cada gasto, productos comprados y gastos anulados.
- Accesos a la planilla de gastos desde Caja e Historial; el detalle de productos también aparece en las tablas de gastos y en la planilla completa del turno.

## 0.9.0 — MVP · etapa de diseño

- Tarjetas de mesa con entrada, salida (corte actual), billar, consumo y total.
- Detalle de mesa y cobro con las horas de entrada y salida visibles.
- Indicador discreto de etapa de diseño y panel de estado del MVP.
- Documentación del alcance y los siguientes pasos.
- Versión de presentación preparada para validación con el dueño.

## 2.0.0 — Base operativa

- Control de mesas, consumos, barra, cobros y cierre de caja.
- Historial de turnos, auditoría, respaldos y exportaciones.
- Administración de mesas, productos y usuarios.
