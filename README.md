# Billar & Bar · Caja local

Sistema local de caja, mesas y control de consumo para billar y bar. Funciona sin internet y guarda toda la información en la computadora del negocio.

> **Estado del proyecto:** MVP funcional en **etapa de diseño y validación** con el dueño del salón. La operación principal ya se puede recorrer de punta a punta; la experiencia de uso, los textos y algunos detalles visuales siguen en revisión antes de la instalación definitiva.
>
> Rama: `mvp/diseno` · Versión: `0.9.0`

## Qué incluye

- **Mesas en vivo:** cronómetro, entrada, salida (corte actual), billar, consumo y total por mesa.
- **Consumos por mesa:** productos de barra, cantidades y control de stock.
- **Cobros:** efectivo, QR y pago mixto, con comprobante para imprimir.
- **Caja diaria:** apertura de turno, fondo inicial, gastos, ventas y cierre con arqueo.
- **Historial:** turnos cerrados, partidas, ventas, gastos, diferencias y auditoría.
- **Administración:** mesas, tarifas, productos, usuarios, respaldos y exportaciones CSV.
- **Operación local:** pensado para funcionar en la computadora del billar, sin depender de la nube.

## Requisitos

- Node.js 22.5 o superior.
- Windows para usar `iniciar.bat` (también se puede ejecutar con los comandos de abajo).

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

En Windows también se puede abrir `iniciar.bat`, que instala dependencias, compila la interfaz y abre el sistema en el navegador.

## Datos y respaldos

- La base de datos local vive en `data/billar.db`.
- Las copias de seguridad se guardan en `data/backups`.
- Esa carpeta no se versiona en Git: los datos del negocio no salen de la computadora.
- El primer usuario administrador se crea con PIN temporal `1234` y el sistema pide cambiarlo al ingresar.

## Estructura

```text
src/            Interfaz React (mesas, caja, historial, ajustes)
server/         API local con Express y SQLite
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
| Cierre de caja y arqueo | Operativo |
| Historial y auditoría | Operativo |
| Experiencia visual y textos | En revisión de diseño |
| Instalación y capacitación | Siguiente hito |

El detalle del alcance y los siguientes pasos está en [`docs/estado-mvp.md`](docs/estado-mvp.md).
