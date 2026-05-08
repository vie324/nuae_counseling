async function fetchFromGas() {
  const gasUrl = process.env.GAS_URL;
  const gasToken = process.env.GAS_API_TOKEN;
  if (!gasUrl) throw new Error('GAS_URL env var is required');
  if (!gasToken) throw new Error('GAS_API_TOKEN env var is required');

  const fullUrl = `${gasUrl}?token=${encodeURIComponent(gasToken)}`;

  const response = await fetch(fullUrl, {
    method: 'GET',
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error(`GAS responded with HTTP ${response.status}`);
  }

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('GAS returned non-JSON response (deployment may not be configured)');
  }

  if (data && data.error) {
    throw new Error(`GAS error: ${data.error}`);
  }

  return data;
}

module.exports = { fetchFromGas };
