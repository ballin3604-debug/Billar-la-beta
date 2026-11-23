# Historial de cambios

## Sin publicar — Asistencia, permisos de cajero y planillas

- Cada mesa tiene un color de identificación distinto, visible en el panel de mesas, el pedido y el cobro para evitar confusiones entre cajeros.
- Las mesas nuevas reciben automáticamente el primer color libre de la paleta; el administrador puede cambiarlo desde `Ajustes > Mesas`.
- Las bases de datos existentes se migran y reciben colores distintos sin perder mesas ni historial.
- Nombre visible del sistema cambiado a **Billar Bar la Beta**. La carpeta interna de instalación se mantiene para conservar los datos existentes.
- Datos transaccionales reiniciados para la beta: sin turnos, partidas, ventas, egresos, asistencias ni auditoría de demostración.
- Nuevo alcance restringido para cajeros: solo ven y operan `Mesas`, `Egresos` y `Cierre`.
- La API exige rol de administrador para historial, asistencia global, detalle de turnos, apertura de caja, ventas de barra y anulaciones.
- El cajero recibe una vista sanitizada del turno: solo sus propios egresos y su propia asistencia; no ve ventas, partidas, pagos QR, resúmenes, arqueo ni auditoría.
- Cierre de caja del cajero con arqueo ciego y sin exigir observaciones por diferencia; el administrador conserva el detalle completo y la exigencia de explicar diferencias.
- La venta rápida de barra y la apertura de caja quedan reservadas al administrador; el cajero ve un aviso de espera si la caja está cerrada.
- Nuevas pestañas `Egresos` y `Cierre` para cajeros, con listado de egresos propios y confirmación de salida sin totales.
- Registro automático de entrada del personal al iniciar sesión con PIN.
- Registro de salida al cerrar sesión o al confirmar el arqueo y cerrar la caja.
- Cierre automático de la jornada anterior sin salida al final de su día, para evitar entradas abiertas acumuladas.
- Los cambios de precio de mesas y productos se registran en auditoría como **Cambio de precios**, con valor anterior y nuevo.
- Los cambios de tarifa base y cobro mínimo también se registran como cambio de precios.
- Cobro de mesas sin mínimo de 5 Bs: desde el primer minuto se cobra en pasos de 0,50 Bs, manteniendo la tarifa por hora de cada mesa.
- Nuevo logo oficial de **Billar Bar la Beta** en la pantalla de acceso, el encabezado y las pantallas de carga.
- La auditoría incluye un filtro rápido **Precios** y marca los cambios de precio como acciones sensibles.
- Nueva sección `Ajustes > Personal` con entradas, salidas, duración, búsqueda y filtro de jornadas sin salida.
- Avisos de entrada/salida en Caja, en el cierre de turno y en el diálogo de caja cerrada.
- La entrada, la salida y la duración de cada persona también aparecen en el detalle del turno y en la planilla imprimible.
- Planilla de asistencia imprimible desde `Ajustes > Personal`, con resumen por persona, detalle de entradas y salidas y filtros aplicados; se puede guardar como PDF desde el diálogo de impresión.
- Acceso directo `Billar Bar la Beta` en el escritorio, con icono propio.
- Lanzador `desktop\BillarBar.exe`: inicia el servidor local sin ventana si hace falta y abre el sistema en una ventana de aplicación sin barra de navegador.
- `iniciar.bat` queda como método de respaldo y diagnóstico.
- Traspasos QR ↔ efectivo: registro de intercambios entre la gaveta y la cuenta QR, con concepto y referencia opcional.
- Los traspasos ajustan el efectivo esperado del cierre y el QR neto del turno, sin contar como venta ni como gasto.
- El administrador ve todos los traspasos y puede anularlos con motivo; el cajero solo ve los propios.
- Los traspasos aparecen en Caja, en el arqueo, en la planilla del turno, en el detalle del historial y en la exportación de turnos.
- Gastos de caja con detalle de productos comprados: cantidad, costo unitario y subtotal por línea.
- El monto del gasto se calcula automáticamente en el servidor cuando se cargan productos.
- Nueva planilla imprimible de gastos con resumen por categoría, detalle de cada gasto, productos comprados y gastos anulados.
- Accesos a la planilla de gastos desde Caja e Historial; el detalle de productos también aparece en las tablas de gastos y en la planilla completa del turno.
- Filtro por rango de fechas en el historial de turnos: botón con icono de calendario, campos **Desde** y **Hasta**, y totales/contadores ajustados al rango elegido.
- Al pulsar **Cobrar mesa** el tiempo y el monto de billar se detienen hasta confirmar el pago; si se cancela el cobro, el tiempo se reanuda sin contar la pausa.
- En egresos, al elegir un producto del catálogo se completa su costo unitario y el subtotal se calcula de forma constante según la cantidad.
- Caja inicial configurable en **Ajustes > Información general**: el administrador define el monto por defecto y los cajeros pueden abrir la caja sin intervención del administrador usando ese fondo.

## 0.9.0 — MVP · etapa de diseño

- Tarjetas de mesa con entrada, salida (corte actual), billar, consumo y total.
- Detalle de mesa y cobro con las horas de entrada y salida visibles.
- Indicador discreto de etapa de diseño y panel de estado del MVP.
- Documentación del alcance y los siguientes pasos.
- Versión de presentación preparada para validación con el encargado.

## 2.0.0 — Base operativa

- Control de mesas, consumos, barra, cobros y cierre de caja.
- Historial de turnos, auditoría, respaldos y exportaciones.
- Administración de mesas, productos y usuarios.
