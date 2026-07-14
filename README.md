# Encuentro Clínico de Psicología

Sitio oficial de **Cuando el Duelo se Detiene: Jornada Clínica sobre Duelo Prolongado**, programada para el 15 de agosto de 2026 en Chimaltenango.

## Desarrollo

Requiere Node.js 22.13 o superior.

```bash
npm install
npm run dev
npm run build
```

## Variables de entorno para Vercel

Copiar `.env.example` y configurar estas variables únicamente en el panel de Vercel:

- `SUPABASE_URL`: URL del proyecto conectado.
- `SUPABASE_SECRET_KEY`: clave secreta de servidor de Supabase. Nunca debe llevar el prefijo `NEXT_PUBLIC_` ni incluirse en el repositorio.

La aplicación utiliza tablas exclusivas con el prefijo `encuentro_psicologico_`, protegidas con RLS. La migración reproducible está en `supabase/migrations/`.

## Funciones principales

- Información, agenda, ejes clínicos y constancias.
- Inscripción presencial con cupo máximo de 250 y lista de espera automática.
- Inscripción virtual.
- Panel de administración, activación de transmisión, patrocinadores y biblioteca.
- Compilación estándar de Next.js compatible con Vercel.
