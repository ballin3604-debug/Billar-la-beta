# Estado del MVP · Billar & Bar

**Versión:** 0.9.0  
**Rama:** `mvp/diseno`  
**Etapa:** Diseño y validación con el dueño del billar  
**Fecha de referencia:** noviembre de 2026

## Objetivo de esta etapa

Presentar al dueño una versión funcional y navegable del sistema, con la operación principal resuelta, para validar la experiencia antes de la instalación definitiva. La prioridad no es agregar más funciones, sino confirmar que la información clave se entienda de un vistazo y que el flujo de trabajo coincida con la operación real del salón.

## Alcance operativo

- Apertura de turno con fondo inicial.
- Control de mesas con cronómetro, tarifa y cobro mínimo.
- Tarjetas de mesa con **entrada**, **salida (corte actual)** y **total**.
- Consumos por mesa y venta rápida de barra.
- Cobros en efectivo, QR y pago mixto.
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
- Detalles visuales de la presentación al dueño.

## Siguiente hito

1. Recorrer el sistema junto al dueño con datos reales del salón.
2. Registrar observaciones de uso y ajustar textos, colores y prioridades.
3. Cerrar la versión de instalación.
4. Instalar en el equipo del billar y capacitar al personal.

## Registro de personal

- La entrada se crea con cada ingreso exitoso con PIN. Si ya hay una jornada abierta del mismo día, no se duplica.
- La salida se registra al confirmar el arqueo y cerrar la caja, no al cerrar sesión ni al bloquear la pantalla.
- Se permiten varias jornadas en el mismo día si la anterior ya fue cerrada.
- El dueño ve todos los registros en `Ajustes > Personal`; la API solo entrega a cada cajero sus propios registros.
- El detalle del turno y la planilla imprimible muestran la entrada, la salida y la duración por persona; el cajero solo ve su propia jornada en esa vista.
- La sección Personal incluye una planilla imprimible con resumen por persona y detalle de entradas y salidas, exportable a PDF mediante el diálogo de impresión.
- Las jornadas sin salida quedan marcadas para revisión.

## Acceso directo

- El icono **Billar & Bar** del escritorio ejecuta `desktop\BillarBar.exe`.
- Si el servidor local no está activo, lo inicia en segundo plano; si ya está activo, solo abre la ventana.
- La ventana usa el modo aplicación de Edge o Chrome, sin barra de direcciones ni pestañas.
- `iniciar.bat` queda como respaldo y herramienta de diagnóstico.
- El acceso directo se puede recrear con `desktop\build-launcher.ps1`.

## Notas de presentación

- El indicador `MVP · diseño` del pie de la aplicación abre el detalle de esta etapa.
- La versión visible en el ingreso es `0.9.0`, coherente con un producto previo a su instalación definitiva.
- Los datos de prueba no se versionan; la carpeta `data/` permanece fuera de Git.
