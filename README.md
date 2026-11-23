# Billar Bar la Beta · Caja local

Sistema local de caja, mesas y control de consumo para billar y bar. Funciona sin internet y guarda toda la información en la computadora del negocio.

> **Estado del proyecto:** MVP funcional en **etapa de diseño y validación** con el encargado del salón. La operación principal ya se puede recorrer de punta a punta; la experiencia de uso, los textos y algunos detalles visuales siguen en revisión antes de la instalación definitiva.
>
> Rama: `mvp/diseno` · Versión: `0.9.0`

## Qué incluye

- **Mesas en vivo:** cronómetro, entrada, salida (corte actual), billar, consumo y total por mesa, con un color distinto por mesa para identificarlas al cobrar.
- **Consumos por mesa:** productos de barra, cantidades y control de stock.
- **Cobros:** efectivo, QR y pago mixto, con comprobante para imprimir.
- **Traspasos QR ↔ efectivo:** intercambios de dinero entre la gaveta y la cuenta QR, con ajuste automático del efectivo esperado y del QR neto del cierre. No cuentan como venta ni como gasto.
- **Caja diaria:** apertura de turno, fondo inicial, gastos —con detalle de productos comprados—, ventas y cierre con arqueo.
- **Planillas:** planilla completa del turno y planilla específica de gastos, ambas imprimibles.
- **Historial:** turnos cerrados, partidas, ventas, gastos, diferencias y auditoría.
- **Personal:** registro automático de entrada al iniciar sesión y de salida al cerrar caja, con duración y filtros para el encargado.
- **Administración:** mesas, tarifas, productos, usuarios, respaldos y exportaciones CSV.
- **Acceso directo:** icono en el escritorio que abre el sistema en una ventana de aplicación, sin barra de navegador.
- **Operación local:** pensado para funcionar en la computadora del billar, sin depender de la nube.

## Requisitos

- Node.js 22.5 o superior.
- Windows para usar el acceso directo o `iniciar.bat` (también se puede ejecutar con los comandos de abajo).

## Ejecutar en desarrollo

```bash
npm install
npm run dev
```

La interfaz queda en `http://127.0.0.1:3000` y la API local en `http://127.0.0.1:3001`.

## Ejecutar en el equipo del negocio

```bash
npm install
npm run build
npm start
```

En Windows también se puede abrir `iniciar.bat`, que instala dependencias, compila la interfaz y abre el sistema en el navegador. Queda como método de respaldo y diagnóstico.

## Acceso directo en Windows

El uso diario recomendado es el icono **Billar Bar la Beta** del escritorio:

1. La primera vez, ejecutar una vez desde la carpeta del proyecto:

   ```powershell
   powershell -ExecutionPolicy Bypass -File desktop\build-launcher.ps1
   ```

   Ese script genera el icono, compila el lanzador y crea el acceso directo en el escritorio.

2. Abrir el sistema con el icono. Si el servidor local no está activo, lo inicia sin mostrar una ventana de consola; si ya está activo, solo abre la ventana de la aplicación.

La ventana usa el modo aplicación de Edge o Chrome: no muestra barra de direcciones ni pestañas. `desktop\BillarBar.exe` es un archivo generado y no se versiona; el código y el script sí.

## Registro de personal

- La **entrada** se guarda automáticamente al ingresar con el PIN.
- La **salida** se guarda al cerrar sesión o al confirmar el arqueo y cerrar la caja.
- Si alguien olvida cerrar sesión, la jornada anterior se cierra automáticamente al final de su día.
- El encargado puede consultar los registros en `Ajustes > Personal`, con búsqueda y filtro de jornadas sin salida.
- El detalle de cada turno y la planilla imprimible incluyen una tabla con el personal, la fecha, la entrada, la salida y la duración. El encargado ve todas las jornadas vinculadas al turno; cada cajero solo ve la suya.
- El botón **Imprimir / PDF** de `Ajustes > Personal` genera una planilla con el resumen por persona y el detalle de entradas y salidas; respeta la búsqueda y el filtro activos. En el diálogo de impresión se elige **Guardar como PDF**.
- Solo puede quedar abierta la jornada del día en curso.

## Roles y permisos

- **Administrador (encargado):** acceso completo a mesas, caja, venta rápida de barra, historial, ajustes, anulaciones, asistencia de todo el personal, reportes y planillas.
- **Cajero:** solo ve las pestañas `Mesas`, `Egresos` y `Cierre`. Puede iniciar y cobrar mesas, registrar sus propios egresos, registrar traspasos QR ↔ efectivo y cerrar la caja con arqueo ciego.
- El cajero no puede abrir la caja ni vender en barra; si la caja está cerrada, ve un aviso para esperar al administrador.
- El cajero no ve totales del turno, ventas, pagos QR, historial, asistencia de otras personas, planillas, ajustes ni anulaciones.
- Sus egresos y su asistencia se limitan a los registros propios. El administrador conserva el detalle completo de cada turno.
- El cajero puede registrar traspasos QR ↔ efectivo, pero solo ve los propios y no puede anularlos.
- Las restricciones se aplican en la API, no solo ocultando botones en la interfaz.

## Planilla de gastos

- Cada gasto puede incluir los productos comprados con cantidad y costo unitario; el total se calcula automáticamente.
- La planilla de gastos muestra el resumen por categoría, el detalle de cada gasto, los productos comprados y los gastos anulados.
- Se abre desde el botón **Planilla de gastos** en Caja o desde el detalle de un turno en Historial.
- El detalle de productos también aparece en las tablas de gastos y en la planilla completa del turno.
- Registrar productos en un gasto no modifica el stock del catálogo: el ajuste de inventario se hace por separado.

## Datos y respaldos

- La base de datos local vive en `data/billar.db`.
- Las copias de seguridad se guardan en `data/backups`.
- Esa carpeta no se versiona en Git: los datos del negocio no salen de la computadora.
- El primer usuario administrador se crea con PIN temporal `1234` y el sistema pide cambiarlo al ingresar.

## Estructura

```text
src/            Interfaz React (mesas, caja, egresos, cierre, historial, ajustes)
server/         API local con Express y SQLite
desktop/        Código, icono y script del acceso directo de Windows
data/           Base de datos y respaldos (no versionado)
documentos/     Cotización y documentación del proyecto
public/         Recursos estáticos
```

## Estado del MVP

| Área | Estado |
| --- | --- |
| Mesas con entrada, salida y total | Operativo |
| Consumos y barra | Operativo |
| Cobros y comprobantes | Operativo |
| Traspasos QR ↔ efectivo | Operativo |
| Cierre de caja y arqueo | Operativo |
| Planilla de gastos con productos | Operativo |
| Entradas y salidas del personal | Operativo |
| Acceso directo de escritorio | Operativo |
| Historial y auditoría | Operativo |
| Experiencia visual y textos | En revisión de diseño |
| Instalación y capacitación | Siguiente hito |

El detalle del alcance y los siguientes pasos está en [`docs/estado-mvp.md`](docs/estado-mvp.md).
