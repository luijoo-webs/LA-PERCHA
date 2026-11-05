-- LA PERCHA — Migración 14: compras del local sin cuenta se enlazan a la cuenta con el mismo correo
-- y las ventas en tienda cuentan para el bono (Club La Percha). Re-ejecutable, no borra datos.

-- Compras que cuentan: pedidos pagados + ventas en tienda no anuladas
create or replace function public._paid_orders(p_user uuid)
returns int language sql stable security definer set search_path = public as $$
  select (select count(*) from orders where user_id = p_user and estado in ('pagado','preparando','enviado','entregado'))::int
       + (select count(*) from sales  where user_id = p_user and estado = 'completada')::int;
$$;
revoke all on function public._paid_orders(uuid) from public, anon, authenticated;

-- Al vender a un cliente con cuenta, o al enlazar una venta, se revisan los bonos
create or replace function public.trg_sale_loyalty()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform _award_loyalty(new.user_id);
  return new;
end $$;
revoke all on function public.trg_sale_loyalty() from public, anon, authenticated;
drop trigger if exists sales_loyalty on public.sales;
create trigger sales_loyalty after insert or update of user_id on public.sales
  for each row when (new.user_id is not null and new.estado = 'completada')
  execute function public.trg_sale_loyalty();

-- Solo si el correo de la cuenta está CONFIRMADO y coincide con el de la compra.
create or replace function public.link_guest_orders()
returns int language plpgsql security definer set search_path = public, auth as $$
declare v_email text; n int := 0; m int := 0;
begin
  select lower(btrim(email)) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if coalesce(v_email, '') = '' then return 0; end if;
  update public.orders set user_id = auth.uid()
   where user_id is null and lower(btrim(cliente->>'email')) = v_email;
  get diagnostics n = row_count;
  update public.sales set user_id = auth.uid()
   where user_id is null and lower(btrim(cliente->>'email')) = v_email;
  get diagnostics m = row_count;
  update public.store_customers set user_id = auth.uid()
   where user_id is null and lower(btrim(email)) = v_email;
  return n + m;
end $$;

-- "Mis pedidos" también muestra las compras del local (sin costos ni notas internas)
create or replace function public.my_orders()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', o.id, 'numero', o.numero, 'created_at', o.created_at, 'estado', o.estado, 'metodo_pago', o.metodo_pago,
      'cliente', o.cliente, 'subtotal', o.subtotal, 'descuento', o.descuento, 'envio', o.envio, 'total', o.total,
      'items_sin_precio', o.items_sin_precio,
      'items', (select coalesce(jsonb_agg(jsonb_build_object('ref', i.ref, 'nombre', i.nombre, 'talla', i.talla, 'color', i.color,
                  'cantidad', i.cantidad, 'precio_unitario', i.precio_unitario, 'subtotal', i.subtotal, 'imagen', i.imagen, 'product_id', i.product_id) order by i.id), '[]'::jsonb)
                from order_items i where i.order_id = o.id),
      'historial', (select coalesce(jsonb_agg(jsonb_build_object('estado', h.estado, 'fecha', h.created_at) order by h.created_at), '[]'::jsonb)
                from order_status_history h where h.order_id = o.id)) as x
    from orders o where o.user_id = auth.uid() and auth.uid() is not null
    union all
    select jsonb_build_object(
      'id', s.id, 'numero', s.numero, 'created_at', s.created_at, 'estado', 'entregado', 'canal', 'fisica', 'metodo_pago', s.metodo_pago,
      'cliente', s.cliente, 'subtotal', s.subtotal, 'descuento', s.descuento, 'envio', null, 'total', s.total,
      'items_sin_precio', 0,
      'items', (select coalesce(jsonb_agg(jsonb_build_object('ref', i.ref, 'nombre', i.nombre, 'talla', i.talla, 'color', i.color,
                  'cantidad', i.cantidad, 'precio_unitario', i.precio_unitario, 'subtotal', i.subtotal, 'imagen', i.imagen, 'product_id', i.product_id) order by i.id), '[]'::jsonb)
                from sale_items i where i.sale_id = s.id),
      'historial', '[]'::jsonb)
    from sales s where s.user_id = auth.uid() and auth.uid() is not null and s.estado = 'completada'
  ) t;
$$;
