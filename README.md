# Viaje a Jerez 🍷

App sencilla y de cachondeo para un finde con los colegas en Jerez. Pensada para
el móvil. Sin contraseñas: entras solo con tu nombre (y una foto si quieres).

## ¿Qué hace?

- **🍻 Contador del cuerpo** — cuenta cubatas, cervezas, finos, chupitos, cigarros,
  aguas... Toca y suma. Se sincroniza en vivo entre todos los móviles.
- **🎯 Misiones diarias** — cada día hay **3 misiones** (2 fáciles = 1 punto, 1
  difícil = 3 puntos), de broma y piques sanos entre vosotros. Las pone el
  **administrador**, y él verifica si se han conseguido (o las rechaza).
- **🏆 Ranking** — dos marcadores: puntos de misiones y "marcador del cuerpo".
- **📸 Fotos** — galería compartida para las mejores (y peores) fotos del viaje.

## Stack

- **Frontend:** Vite + React + Tailwind CSS
- **Backend:** Supabase (base de datos + almacenamiento de fotos + realtime)
- **Hosting:** Cloudflare Pages

---

## Puesta en marcha (paso a paso)

### 1. Supabase

1. Crea una cuenta gratis en [supabase.com](https://supabase.com) y un proyecto nuevo.
2. Ve a **SQL Editor → New query**, pega TODO el contenido de
   [`supabase/schema.sql`](supabase/schema.sql) y dale a **Run**.
3. Ve a **Storage** y crea **dos buckets públicos**:
   - `avatars` (marca *Public bucket*)
   - `fotos` (marca *Public bucket*)
   - *(Vuelve a ejecutar la sección final del `schema.sql` si creaste los buckets
     después, para aplicar las políticas de Storage.)*
4. Ve a **Project Settings → API** y copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

### 2. Probar en local

```bash
npm install
cp .env.example .env     # rellena tus claves de Supabase
npm run dev
```

Abre http://localhost:5173 en el móvil (misma wifi) o en el navegador.

### 3. Desplegar en Cloudflare Pages

1. Sube este repo a GitHub.
2. En Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**.
3. Configuración de build:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. En **Settings → Environment variables**, añade:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ADMIN_CODE` (el código para hacerse admin)
5. Deploy. ¡Listo! Comparte la URL con tus colegas de Madrid.

---

## ¿Cómo ser administrador?

Dentro de la app, toca tu avatar (arriba a la derecha) → **Ajustes** → mete el
**código de admin** (`VITE_ADMIN_CODE`, por defecto `jerez`). A partir de ahí
puedes generar las misiones del día y verificar las de cada uno.

## Notas

- Es una app **privada entre amigos**: cualquiera con el enlace puede entrar y
  escribir. No metas datos sensibles.
- El catálogo de consumiciones está en `src/lib/consumiciones.js` y el banco de
  misiones en `src/lib/misionesPreset.js`. Tócalos a tu gusto.

## Ideas para más adelante

- Notificaciones del navegador para recordar hacer fotos cada cierto tiempo.
- Reto de "foto a la misma hora" todos a la vez.
- Estadísticas del viaje (gráficas de quién bebió más y cuándo).
