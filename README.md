# Control de Turnos 24/7 (SaaS)

Sistema web integral de planificación de turnos 24/7 con rotación continua, asistencia geolocalizada desde el celular con geocerca GPS y liquidación de jornales para empresas con operaciones ininterrumpidas.

Desarrollado a medida para la administración de **Aldo Samudio**.

---

## 🚀 Características Principales

1. **Gestión de Turnos 24/7 y Cuadrillas**:
   - 3 cuadrillas fijas y 1 cuadrilla volante con rotación ergonómica hacia adelante (`2M -> 2T -> 2N -> 2L`).
   - Plantillas preconfiguradas:
     - **Mañana (M)**: 06:00 a 14:00 (8h diurnas).
     - **Tarde (T)**: 14:00 a 22:00 (6h diurnas + 2h nocturnas).
     - **Noche (N)**: 22:00 a 06:00 del día siguiente (8h nocturnas al 100%).
     - **Libre (L)**: Descanso programado.
   - Meta operativa inicial: **2 personas presentes por turno** las 24 horas del día.
   - Publicación controlada del calendario para visibilidad del personal.

2. **Marcación Móvil Geolocalizada**:
   - Acceso optimizado para teléfonos celulares con botón grande de marcación.
   - **Geocerca configurable**: Sede de trabajo con coordenadas GPS y radio de tolerancia en metros.
   - Ubicación solicitada **únicamente al pulsar el botón** con explicación transparente al funcionario.
   - Validación en servidor de distancia y precisión GPS; uso estricto de la hora del servidor.
   - Prevención de duplicados (doble toque) mediante tokens de idempotencia.
   - Asociación inteligente de turnos que cruzan medianoche (salida a las 06:00 vinculada al turno iniciado la noche anterior).

3. **Panel de Control y Supervisión Administrativa**:
   - Responde al instante: **quién tenía que venir, quién llegó, a quién le falta una marca y qué incidencias hay pendientes**.
   - Corrección manual de asistencia con motivo obligatorio y trazabilidad inmutable en bitácora de auditoría.
   - Distinción visual y de datos entre: *Día Libre*, *Ausencia*, *Incompleta* y *Completa*.

4. **Módulo de Reportes Oficiales & Exportación Excel / PDF**:
   - **Reporte 1: Asistencia Diaria**: Programados, presentes, faltas y novedades.
   - **Reporte 2: Historial Individual**: Hoja por funcionario, idéntica a `Historial Horas Noviembre_2026 (RESUMEN 15 DIAS).xlsx`.
   - **Reporte 3: Horas y Jornales por Período**: Días completos, medios jornales (4h+), horas diurnas y nocturnas.
   - **Reporte 4: Cobertura de Turnos**: Comparativa frente al objetivo de 2 personas por turno, idéntico a `Planificacion_Turnos_Noviembre_MEPY.xlsx` (3 pestañas: *Resumen y Cuadrillas*, *Programación General*, *Calendario por Equipos*).
   - **Reporte 5: Incidencias y Correcciones**: Auditoría de problemas de GPS, olvidos y modificaciones.
   - **Reporte 6: Cierre del Período**: Congelamiento histórico e inmutable para liquidación quincenal o mensual.

5. **Reglas de Pago y Franja Nocturna**:
   - Franja nocturna configurable: **20:00 a 06:00** con **30% de recargo**.
   - Jornal base configurable por funcionario en Guaraníes (PYG ₲).
   - Modalidad de medio jornal sujeta a confirmación administrativa; mientras tanto, los importes se mantienen como *«Pendiente de configuración»*.

---

## 🛠️ Stack Tecnológico

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, Server Actions, TypeScript)
- **Estilos**: [Tailwind CSS](https://tailwindcss.com/) (Paleta profesional Azul Petróleo `#0F4F5F`)
- **Base de Datos**: [Neon Postgres Serverless](https://neon.tech/) con [Drizzle ORM](https://orm.drizzle.team/)
- **Migraciones**: Drizzle Kit versionado en SQL en `./drizzle`
- **Autenticación**: Sesiones seguras HTTP-only firmadas con `jose` (JWT) y contraseñas con `bcryptjs`
- **Exportaciones**: [ExcelJS](https://github.com/exceljs/exceljs) (.xlsx nativo) y [jsPDF](https://github.com/parallax/jsPDF) + AutoTable (A4)
- **Zona Horaria**: Oficial `America/Asuncion` (Paraguay)

---

## 💻 Ejecución Local

### 1. Clonar e Instalar Dependencias
```bash
cd control-de-turnos
npm install
```

### 2. Configurar Variables de Entorno
Copiá el archivo `.env.example` a `.env.local`:
```bash
cp .env.example .env.local
```

### 3. Ejecutar en Modo Desarrollo
```bash
npm run dev
```
Abrí [http://localhost:3000](http://localhost:3000) en tu navegador.

### 4. Credenciales de Demostración
- **Administrador**:
  - Correo: `aldo.samudio@empresa.com.py`
  - Contraseña: `Control2026!`
- **Funcionario Mañana (Equipo A)**:
  - Correo: `porfirio.gimenez@demo.com`
  - Contraseña: `Control2026!`
- **Funcionario Volante (Equipo D)**:
  - Correo: `edgar.romero@demo.com`
  - Contraseña: `Control2026!`

---

## 🗄️ Conexión con Neon Postgres y Migraciones

### 1. Crear Base de Datos en Neon
1. Ingresá a [neon.tech](https://neon.tech) y creá un nuevo proyecto Postgres.
2. Copiá la URL de conexión que proporciona Neon (`postgresql://...`).
3. Pegá la URL en tu `.env.local` en la variable `DATABASE_URL`.

### 2. Aplicar Migraciones Versionadas
```bash
# Generar nuevas migraciones si cambias el schema
npm run db:generate

# Aplicar las migraciones existentes en Neon Postgres
npm run db:migrate
```

### 3. Crear el Primer Administrador (Sin Contraseña Fija)
Para crear el usuario administrador inicial de Aldo Samudio sin dejar contraseñas quemadas en el código:
```bash
# Pasando la contraseña deseada como variable de entorno:
INITIAL_ADMIN_PASSWORD="TuContraseñaSegura123!" npm run db:seed

# O como parámetro en la línea de comando:
npm run db:seed "TuContraseñaSegura123!"
```

---

## ☁️ Despliegue en Vercel y GitHub

### Paso 1: Subir el Repositorio a GitHub
```bash
git init
git add .
git commit -m "feat: SaaS Control de Turnos 24/7 completo con exportaciones Excel y PDF"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/control-de-turnos.git
git push -u origin main
```

### Paso 2: Conectar con Vercel
1. Ingresá a [vercel.com](https://vercel.com) e importá el repositorio de GitHub.
2. En la sección **Environment Variables**, agregá:
   - `DATABASE_URL`: La URL de tu base de datos Neon Postgres.
   - `AUTH_SECRET`: Cadena aleatoria de 32+ caracteres (`openssl rand -base64 32`).
   - `SESSION_COOKIE_NAME`: `control_turnos_session`
   - `APP_TIMEZONE`: `America/Asuncion`
   - `NEXT_PUBLIC_APP_URL`: La URL de producción (`https://tu-proyecto.vercel.app`).
   - `NEXT_PUBLIC_DEFAULT_WORKPLACE_LAT`: `-25.2867`
   - `NEXT_PUBLIC_DEFAULT_WORKPLACE_LNG`: `-57.6470`
   - `NEXT_PUBLIC_DEFAULT_GEOFENCE_RADIUS_METERS`: `300`
3. Hacé clic en **Deploy**.

---

## 🧪 Comprobación de Pruebas Automatizadas

El proyecto cuenta con una suite completa de 25 pruebas automatizadas:
```bash
npx tsx tests/verification.ts
```
Verifica:
- Geocerca GPS (adentro, afuera, baja precisión).
- Turnos nocturnos de 22:00 a 06:00 que cruzan medianoche.
- Medios jornales aprobados (4h).
- Prevención de duplicados por doble toque (idempotencia).
- Corrección manual de marcas con motivo obligatorio y bitácora de auditoría.
- Conservación de registros para funcionarios dados de baja.
- Exportación exacta a Excel (.xlsx) y PDF (A4).
