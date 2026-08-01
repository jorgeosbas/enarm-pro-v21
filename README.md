# ENARM Pro — Etapa 2

App personal de preparación para el ENARM. Un solo usuario, con importador
de preguntas desde texto.

## 1. Crear tu proyecto en Supabase

1. Ve a https://supabase.com → "New project" (plan gratuito).
2. Cuando esté listo, ve a **SQL Editor** → pega el contenido de
   `supabase/migrations/0001_init.sql` → Run. Esto crea las tablas y la
   seguridad (RLS).
3. Ve a **Authentication → Users → Add user** y créate un usuario con tu
   correo y una contraseña. Esta es tu única cuenta — no hay registro
   público en la app.
4. Ve a **Project Settings → API** y copia:
   - `Project URL`
   - `anon public key`

## 2. Configurar el proyecto localmente

```bash
npm install

cp .env.local.example .env.local
# Pega ahí tu Project URL y anon key
```

## 3. (Opcional) Generar tipos reales desde tu esquema

```bash
npx supabase login
npx supabase gen types typescript --project-id TU_PROJECT_ID --schema public > src/types/database.types.ts
```

Si te lo saltas, el placeholder en `src/types/database.types.ts` deja
correr la app pero sin autocompletado fuerte en las consultas.

## 4. Correr en desarrollo

```bash
npm run dev
```

Abre `http://localhost:3000` → te manda a `/login` → entra con el usuario
que creaste en el paso 1.3 → ve a **Importar preguntas** y pega el texto
de ejemplo que aparece como placeholder para probar.

## 5. Publicar para usarla desde tu celular

```bash
npx vercel
```

Sigue las instrucciones (conecta tu cuenta de Vercel), y cuando pregunte
por variables de entorno agrega las mismas dos de `.env.local`. Al
terminar te da una URL — esa es la que abres desde tu celular.

## Formato de importación de preguntas

```
---
especialidad: Cardiología
dificultad: media
tema: Síndromes coronarios agudos
---
P: Texto de la pregunta clínica...
A) Opción 1
*C) Opción correcta (marcada con asterisco)
D) Opción 4
EXPLICACION: Texto de la explicación (opcional)

===

P: Siguiente pregunta...
```

- El bloque `---` inicial es opcional y aplica a todas las preguntas del archivo.
- `*` antes de la letra marca la respuesta correcta (debe haber exactamente una).
- `===` separa preguntas.
- Puedes generar este texto con ChatGPT, Gemini o Claude — solo dales el
  formato de arriba como instrucción — o escribirlo tú mismo.

## Qué sigue (Etapa 3)

- Dashboard real conectado a tus datos (ya no placeholder)
- Pantallas de estudio: responder preguntas del banco, flashcards con FSRS
- Página de Exportar (usa `exportQuestionsToText` ya incluido en el código)
- Importador de flashcards (usa `parseFlashcards.ts`, ya incluido, falta la UI)
