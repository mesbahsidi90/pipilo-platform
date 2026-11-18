import { cloud, db, listOrders } from './store';
import { t } from './i18n';

export async function loadReportOrders({ from, to }, { isActive = () => true, branch } = {}) {
  if (!cloud)
    return (await listOrders())
      .filter((order) => order.created_at >= from && order.created_at < to)
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));

  const { data: shop, error: shopError } = await db.rpc('current_shop_id');
  if (shopError) throw shopError;
  if (!shop || (branch && branch !== shop)) throw new Error(t('حسابك ما راهوش مربوط بمحل.'));

  const orders = [];
  const batchSize = 500;
  for (let offset = 0; isActive(); offset += batchSize) {
    const { data, error } = await db
      .from('orders')
      .select('id,number,status,created_at,ready_at,collected_at')
      .eq('shop_id', shop)
      .gte('created_at', from)
      .lt('created_at', to)
      .order('created_at', { ascending: false })
      .order('id')
      .range(offset, offset + batchSize - 1);
    if (error) throw error;
    orders.push(...data);
    if (data.length < batchSize) break;
  }
  return orders;
}
