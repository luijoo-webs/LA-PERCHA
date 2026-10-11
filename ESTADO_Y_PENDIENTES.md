# La Percha — Estado de la adaptación y pendientes

Tienda Pro basada en la arquitectura de WESNOCK, con identidad, catálogo, configuración y base de datos propias.
La versión original de WESNOCK no se modificó (copia de referencia en `_base_wesnock/`, excluida del repositorio).

## Qué se conservó (sin cambios de lógica)
- SPA en un solo `index.html` (rutas hash), carrito, checkout en 4 pasos, confirmación por WhatsApp.
- Supabase: Auth (registro, login, recuperación de contraseña), roles admin/cliente con RLS, pedidos atómicos (`create_order` con bloqueo de fila), inventario por variante (talla × color) con historial de movimientos, ventas físicas con el mismo inventario, costos y ganancia bruta histórica, estadísticas con filtros de periodo, clientes, direcciones, favoritos, notificaciones en tiempo real, pre-factura PDF, Edge Function de correo.

## Qué se adaptó
- **Marca**: nombre, logo (PNG transparente generado del logo entregado), favicon, imagen para compartir, tema negro carbón + dorado (con opción de tema claro en Admin → Configuración), tipografías (Cormorant Garamond para títulos, Great Vibes en el pie), textos comerciales, portada nueva, sección “Visítanos”, pie de página, PDF de pre-factura.
- **Datos**: WhatsApp 573144543114, dirección Cra. 19E2 #13B-46 La Elvira (enlace a Google Maps con las coordenadas), Instagram y TikTok, envíos a toda Colombia, prefijo de pedidos `LP-`.
- **Pagos** (manuales, cierre por WhatsApp): contraentrega, efectivo en tienda, Nequi, Daviplata, Bancolombia. **Addi** listo pero desactivado (se activa en Configuración; widget opcional con ally slug). Flujos de estado: pagos anticipados pasan por “pago pendiente → pagado” (frontend y SQL coinciden).
- **Políticas**: página `#/politicas` con envíos, cambios (5 días hábiles), derecho de retracto (Ley 1480), garantía y datos personales (Ley 1581). **Texto base: debe revisarlo el cliente/un asesor.**
- **Catálogo**: 420 productos en 16 categorías, tomados del catálogo web del cliente (nombres creados a partir de cada foto, precios y tallas del catálogo). Fotos optimizadas en `img/catalogo/` (versión grande y miniatura).
- **SQL**: `supabase/01_schema.sql` y `02_ventas_facturacion_notificaciones.sql` adaptados (categorías, configuración, métodos de pago, flujos). Carrito con almacenamiento propio (`lpc1_`) para no mezclarse con otra tienda en el mismo dominio.

## Verificado (vista previa local con el catálogo inicial, sin base de datos)
- Portada, listado, ficha de producto, carrito, pasos 1–3 del checkout y revisión del pedido; responsive en móvil (375 px, sin scroll horizontal).
- Carrito: 1 × 250.000 + 3 × 55.000 = 415.000; producto sin precio queda “a confirmar”.
- Métodos de pago mostrados: los 5 activos; Addi oculto mientras está desactivado.
- Sin errores de JavaScript (solo los 404 esperados porque las tablas aún no existen).

## NO verificado todavía (requiere ejecutar el SQL en Supabase)
Guardar pedidos, descuento de inventario, autenticación, panel administrativo, estadísticas, ventas físicas,
notificaciones en tiempo real, permisos de cliente vs. admin. Ver `supabase/INSTRUCCIONES.md`.

## Pendientes que necesito del cliente
1. **Fotos de sandalias perdidas (error mío).** Al generar las imágenes borré por accidente la carpeta `Catalogo/`
   (17 fotos). Restauré desde su Drive las 3 que había ahí. Faltan 14 fotos; 5 productos nuevos quedaron fuera
   del catálogo hasta tenerlas: Adidas negra con blanco (37-38 a 43-44), Adidas negra (41-42, 43-44),
   Karl Lagerfeld, Monastery negras y Psycho Bunny (43-44). Las demás coincidían con productos del catálogo web.
2. **Precios de los 123 tenis** (el catálogo web no los tiene) y sus tallas disponibles (quedan como “Por confirmar”).
3. **Tallas de las chanclas** del catálogo web (quedan “Por confirmar”, salvo las que venían en la carpeta).
4. Confirmar el precio de “Chancla Cross Slides Negra” (asumí $100.000 como el resto de chanclas).
5. Correo de contacto/facturación, NIT y razón social (Admin → Facturación).
6. Datos de cuentas Nequi, Daviplata y Bancolombia (se escriben en Admin → Configuración, texto de cada método).
7. Correo del vendedor para crear la cuenta de administrador.
8. Revisar etiquetas del catálogo web que no coinciden con la foto:
   - LP-0025 “Camiseta Monogram Blanca”: en la web dice “EMOTION”.
   - Chancla Monastery Laurel Crest Blanco: en la web dice “CLEMONT”.
   - Conjunto Nike Dry Fit Track Negro: la foto muestra tres franjas.
   - Buzo Camo Planet: en la web dice “HELL STAR”.
   - Polo Hugo Essential: en la web dice “NEGRO” y la foto principal es blanca.
9. Costos de compra de cada producto (para la ganancia bruta).
10. Revisión legal de las políticas y aviso: el logo usa el monograma de otra marca y los productos son calidad 1.1;
    los textos nunca dicen “original”.

## Vista previa local
`python -m http.server 5173` en esta carpeta y abrir `http://localhost:5173/?preview` (solo funciona en localhost
y solo mientras la base de datos no esté instalada).
