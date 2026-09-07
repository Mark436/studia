# Studia

Studia es una PWA móvil para que estudiantes consulten rápidamente su información
académica. Reúne el horario, las calificaciones y los datos del alumno en una
experiencia enfocada en las tareas cotidianas, en lugar de reproducir un portal
administrativo institucional.

## Funcionalidades

- Inicio de sesión contra el servicio académico SITH.
- Horario del día en una línea de tiempo, con clase actual y próximas clases.
- Consulta de calificaciones.
- Perfil del alumno y progreso académico.
- Navegación inferior optimizada para dispositivos móviles.
- Diseño responsive para móvil, tablet y escritorio.
- Proxy opcional de Netlify para evitar CORS y mixed content en producción.

El proyecto se encuentra en desarrollo activo. La persistencia local, el
pull-to-refresh y el home condicional ya están implementados; los passkeys
(WebAuthn) siguen pendientes.

## Tecnologías

- React 19 y TypeScript.
- Vite 8.
- Tailwind CSS 4.
- `sith-api-client` para el acceso a la API académica.
- `vite-plugin-pwa` para el manifest y el service worker.
- Oxlint para linting.

## Requisitos

- Node.js compatible con las versiones actuales de Vite y TypeScript.
- [pnpm](https://pnpm.io/).

Instala las dependencias desde la raíz del repositorio:

```bash
pnpm install
```

## Desarrollo local

Copia `.env.example` como `.env` y configura `VITE_API_URL` cuando sea necesario:

```env
VITE_API_URL=
```

Con `VITE_API_URL` vacío, el cliente usa directamente el endpoint oficial de SITH
(HTTP plano; en Codespaces o HTTPS producirá CORS/mixed-content). Para un
entorno HTTPS o una configuración local con proxy, usa una URL como:

```env
VITE_API_URL=http://localhost:8888/api/sith
```

En `pnpm dev` plano (sin `netlify dev`), `vite.config.ts` incluye un proxy que
monta `/api/sith` → `http://sith.ith.mx/XTodo/wr`. Configura `.env` con:

```env
VITE_API_URL=/api/sith
```

Así el navegador llama a la misma origen (útil en Codespaces) y Vite proxea
servidor a servidor, sin CORS. Esa ruta relativa también es la correcta en
producción, donde la responde la Netlify Function en `/api/sith`.

Inicia el frontend con:

```bash
pnpm dev
```

Para probar la Netlify Function localmente, utiliza `netlify dev` con
`VITE_API_URL=http://localhost:8888/api/sith`.

## Comandos

| Comando        | Propósito                                   |
| -------------- | ------------------------------------------- |
| `pnpm dev`     | Inicia el servidor de desarrollo con HMR     |
| `pnpm build`   | Typecheck (`tsc -b`) y build de producción   |
| `pnpm lint`    | Ejecuta Oxlint                              |
| `pnpm test`    | Ejecuta las pruebas de vitest               |
| `pnpm preview` | Sirve localmente el build de producción      |

## Seguridad y datos

Las contraseñas no se guardan en `localStorage`, `sessionStorage`, IndexedDB,
cookies ni variables de entorno. El login conserva las credenciales únicamente en
memoria durante la sesión activa, porque el servicio actual requiere credenciales
para cada consulta.

Las variables `VITE_*` son públicas y quedan incluidas en el bundle del frontend;
nunca deben contener secretos.

## Documentación

- [Producto](docs/product.md): objetivos, navegación y comportamiento esperado.
- [Arquitectura](docs/architecture.md): límites entre aplicación, features e infraestructura.
- [Diseño](docs/design.md): tokens visuales y reglas de interfaz.
- [API](docs/api.md): cliente SITH, proxy, datos y limitaciones conocidas.
- [Roadmap](ROADMAP.MD): trabajo pendiente y estado del proyecto.
