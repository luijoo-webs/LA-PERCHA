# La Percha — Puesta en marcha con Supabase

Proyecto **propio e independiente** de La Percha: `https://zynoecehvssvtfdktqyj.supabase.co`
(ya conectado en `index.html` con la clave **publishable**, que es pública).
No comparte base de datos, usuarios, pedidos ni archivos con ninguna otra tienda.

> Nunca pongas la `service_role` key, la contraseña de la base de datos ni otros secretos en `index.html` ni en el repositorio.

## 1. Crear la base de datos (una sola vez, en este orden)
1. Supabase → **SQL Editor** → **New query** → pega TODO `supabase/01_schema.sql` → **Run**.
2. Nueva consulta → pega TODO `supabase/02_ventas_facturacion_notificaciones.sql` → **Run**.

Ambos son re-ejecutables y no borran datos. Crean tablas, relaciones, funciones RPC, triggers,
políticas RLS, el bucket de Storage `productos`, Realtime, las 16 categorías de La Percha y la
configuración inicial (WhatsApp 314 454 3114, dirección, redes, métodos de pago, prefijo `LP-`).

## 2. Configurar Auth
Authentication → **URL Configuration**:
- **Site URL**: la URL donde quede publicada la tienda (GitHub Pages mientras tanto, p. ej. `https://TU_USUARIO.github.io/la-percha/`; después el dominio propio).
- **Redirect URLs**: agrega esa misma URL (y `http://localhost:5173/` si pruebas en local).

Authentication → Providers → Email: deja **Confirm email** activado.
El correo integrado de Supabase tiene un límite bajo de envíos por hora; para producción configura SMTP propio
(Authentication → Emails → SMTP Settings) con el correo de La Percha cuando esté disponible.

## 3. Crear el administrador (el vendedor)
1. Authentication → **Users** → **Add user** → **Create new user**: correo del vendedor + contraseña segura, marca **Auto Confirm User**.
2. SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'CORREO_DEL_VENDEDOR';
   ```
Solo las cuentas con rol `admin` entran a `#/admin`. Los clientes que se registran quedan con rol `client`.

## 4. Cargar el catálogo inicial
Abre la tienda en `#/admin` → inicia sesión → **Productos** → **Cargar catálogo inicial**
(importa los productos de `img/catalogo/catalogo.json`: nombres, fotos, tallas y precios del catálogo web de La Percha).

Después:
- **Inventario**: registra el stock real por talla (uno por uno o “Asignar a variantes sin registrar”).
  Mientras una variante no tenga stock registrado se vende sin control de inventario.
- **Productos → filtro “Sin precio”**: los tenis no tienen precio en el catálogo web; asígnalos.
- **Productos → filtro “Sin costo”**: registra el costo de cada producto para calcular la ganancia bruta.

## 5. Correo de comprobantes de venta física (opcional)
Despliega `supabase/functions/enviar-documento-venta` (Supabase CLI: `supabase functions deploy enviar-documento-venta`)
y configura los secretos `RESEND_API_KEY` y `EMAIL_FROM` (p. ej. `La Percha <ventas@tudominio.com>`).
Sin esto, el PDF de la pre-factura se puede descargar e imprimir igual.

## 6. Publicar en GitHub Pages
Sube `index.html`, `assets/` e `img/` (todas las rutas son relativas). No subas `_base_wesnock/`
(archivos de la otra tienda) ni `Catalogo/` (fotos fuente); el `.gitignore` ya los excluye.

## 7. Addi (cuando esté aprobado)
Admin → Configuración → Métodos de pago → activa **Addi** y escribe el identificador de comercio (ally slug)
que entrega Addi. Confirma con Addi la URL del script del widget.

## 8. Pruebas recomendadas después de instalar
- Pedido desde el celular como invitado → aparece en segundos en el panel del computador (indicador “En vivo”).
- Última unidad: stock 1 en una talla, comprar desde dos dispositivos a la vez → solo uno lo logra.
- Venta física en Admin → Ventas → Nueva venta → baja el mismo inventario de la tienda online.
- Cancelar un pedido → las unidades vuelven al inventario.
- Una cuenta de cliente que intente abrir `#/admin` ve “no tiene permisos de administrador”.
