
import dns from 'dns';

const hostname = 'aws-1-ap-south-1.pooler.supabase.com';

console.log(`Resolving ${hostname}...`);

dns.resolve4(hostname, (err, addresses) => {
  if (err) console.error('IPv4 Error:', err);
  else console.log('IPv4 Addresses:', addresses);
});

dns.resolve6(hostname, (err, addresses) => {
  if (err) console.error('IPv6 Error (expected if not supported):', err);
  else console.log('IPv6 Addresses:', addresses);
});
