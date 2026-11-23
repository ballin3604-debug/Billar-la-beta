# Estado del MVP · Billar Bar la Beta

**Versión:** 0.9.0  
**Rama:** `mvp/diseno`  
**Etapa:** Diseño y validación con el encargado del billar  
**Fecha de referencia:** noviembre de 2026

## Objetivo de esta etapa

Presentar al encargado una versión funcional y navegable del sistema, con la operación principal resuelta, para validar la experiencia antes de la instalación definitiva. La prioridad no es agregar más funciones, sino confirmar que la información clave se entienda de un vistazo y que el flujo de trabajo coincida con la operación real del salón.

## Alcance operativo

- Apertura de turno con fondo inicial.
- Control de mesas con cronómetro, tarifa por hora y cobro en pasos de 0,50 Bs desde el primer minuto, sin mínimo por defecto.
- Color de identificación por mesa, asignado automáticamente y editable desde `Ajustes > Mesas`, visible en el panel, el pedido y el cobro.
- Tarjetas de mesa con **entrada**, **salida (corte actual)** y **total**.
- Consumos por mesa y venta rápida de barra.
- Cobros en efectivo, QR y pago mixto.
- Traspasos QR ↔ efectivo con ajuste del efectivo esperado y del QR neto del turno.
- Comprobantes y planillas para imprimir.
- Gastos, cierre de caja y arqueo con diferencia.
- Planilla de gastos con detalle de productos comprados, resumen por categoría y gastos anulados.
- Registro automático de entrada del personal al iniciar sesión y de salida al cerrar caja.
- Historial de turnos, partidas, ventas y auditoría.
- Administración de mesas, productos, usuarios, personal y respaldos.
- Acceso directo de escritorio con ventana de aplicación, sin barra de navegador.

## En revisión de diseño

- Lectura y jerarquía de las tarjetas de mesa.
- Claridad de los textos para el personal del salón.
- Distribución de la información en pantallas pequeñas.
- Flujo de cobro rápido y confirmaciones.
- Detalles visuales de la presentación al encargado.

## Siguiente hito

1. Recorrer el sistema junto al encargado con datos reales del salón.
2. Registrar observaciones de uso y ajustar textos, colores y prioridades.
3. Cerrar la versión de instalación.
4. Instalar en el equipo del billar y capacitar al personal.

## Registro de personal

- La entrada se crea con cada ingreso exitoso con PIN. Si ya hay una jornada abierta del mismo día, no se duplica.
- La salida se registra al cerrar sesión o al confirmar el arqueo y cerrar la caja.
- Si alguien olvida cerrar sesión, la jornada anterior se cierra automáticamente al final de su día para no acumular entradas abiertas.
- Se permiten varias jornadas en el mismo día si la anterior ya fue cerrada.
- El encargado ve todos los registros en `Ajustes > Personal`; la API solo entrega a cada cajero sus propios registros.
- El detalle del turno y la planilla imprimible muestran la entrada, la salida y la duración por persona; el cajero solo ve su propia jornada en esa vista.
- La sección Personal incluye una planilla imprimible con resumen por persona y detalle de entradas y salidas, exportable a PDF mediante el diálogo de impresión.
- Solo puede quedar abierta la jornada del día en curso.

## Traspasos QR ↔ efectivo

- **Entregar efectivo:** el cliente paga por QR y recibe efectivo de la gaveta. Baja el efectivo esperado y sube el QR neto.
- **Entregar QR:** el cliente paga en efectivo y recibe una transferencia QR. Sube el efectivo esperado y baja el QR neto.
- El monto no se suma a las ventas ni a los gastos: es un intercambio de medios de pago.
- El cajero puede registrar traspasos y ve solo los propios; el administrador ve todos y puede anularlos con motivo.
- El cierre, la planilla del turno, el detalle del historial y la exportación de turnos muestran el efecto de los traspasos.

## Auditoría de precios

- Los cambios de tarifa de una mesa y de precio de un producto se registran en auditoría como **Cambio de precios**.
- El registro guarda el valor anterior y el nuevo, además del usuario, la fecha y el turno.
- Los cambios de tarifa base y cobro mínimo en `Ajustes > Negocio` también se registran como cambio de precios.
- Estas acciones se incluyen en el filtro **Solo sensibles** y tienen un filtro rápido **Precios** en la auditoría.

## Roles y permisos

- **Administrador (encargado):** mantiene todas las vistas y reportes: mesas, caja, venta rápida de barra, historial, ajustes, anulaciones, asistencia global, auditoría, exportaciones y planillas.
- **Cajero:** su alcance se limita a `Mesas`, `Egresos` y `Cierre`. Puede iniciar y cobrar mesas, registrar egresos propios y cerrar la caja con arqueo ciego.
- El cajero no puede abrir la caja, vender en barra, anular movimientos, consultar historial ni entrar a ajustes. Si la caja está cerrada, ve un aviso para esperar la apertura del administrador.
- La API valida el rol de administrador para historial, asistencia, detalle de turnos, apertura de caja, ventas de barra y anulaciones. La restricción no depende de ocultar botones en la interfaz.
- El estado del turno que recibe el cajero está sanitizado: solo incluye sus propios egresos y su propia asistencia. No incluye ventas, partidas, pagos QR, resúmenes, arqueo, auditoría ni el fondo inicial.
- El cierre del cajero usa arqueo ciego y no exige observaciones por diferencia, para no revelar si hubo faltante o sobrante. El administrador sí debe explicar las diferencias y recibe el detalle completo del cierre.
- El administrador conserva el detalle completo de los turnos cerrados por cajeros, incluyendo diferencias, egresos y asistencia.

## Acceso directo

- El icono **Billar Bar la Beta** del escritorio ejecuta `desktop\BillarBar.exe`.
- Si el servidor local no está activo, lo inicia en segundo plano; si ya está activo, solo abre la ventana.
- La ventana usa el modo aplicación de Edge o Chrome, sin barra de direcciones ni pestañas.
- `iniciar.bat` queda como respaldo y herramienta de diagnóstico.
- El acceso directo se puede recrear con `desktop\build-launcher.ps1`.

## Notas de presentación

- El indicador `MVP · diseño` del pie de la aplicación abre el detalle de esta etapa.
- La versión visible en el ingreso es `0.9.0`, coherente con un producto previo a su instalación definitiva.
- Los datos de prueba no se versionan; la carpeta `data/` permanece fuera de Git.
