import { getActiveGroups } from '../database/groupRepository';
import { generateAffiliateMessage } from './affiliateService';
import { getDb } from '../database/db';

const TELEGRAM_CHANNELS = [
    // Canais focados em Hardware e Gamer
    'https://t.me/s/nerdofertas',
    'https://t.me/s/promosadrenaline',
    'https://t.me/s/pcbuildbr',
    'https://t.me/s/ofertas_pc_gamer',
    'https://t.me/s/PromosGamerBR',
    'https://t.me/s/BenchPromos',
    'https://t.me/s/gatunodeofertas',
    'https://t.me/s/TioBalaOfertas',
    'https://t.me/s/DicasPC',
    'https://t.me/s/ofertas_gamer',
    
    // Canais Gigantes Genéricos (O bot vai filtrar apenas os itens de PC/Gamer desses canais automaticamente)
    'https://t.me/s/pelando',
    'https://t.me/s/promobit',
    'https://t.me/s/canaltech_ofertas',
    'https://t.me/s/ofertastecnoblog',
    'https://t.me/s/QualyPromo',
    'https://t.me/s/promosninjas',
    'https://t.me/s/PromocoeseOfertas'
];

export async function initAutoPromo(socket: any) {
    // Roda a cada 2 minutos
    setInterval(() => checkAndSendPromo(socket), 2 * 60 * 1000);
    // Executa uma vez no início (com delay de 15s para garantir conexão)
    setTimeout(() => checkAndSendPromo(socket), 15000);
}

async function checkAndSendPromo(socket: any) {
    try {
        console.log('🔄 [AutoPromo] Buscando novas ofertas de tecnologia e hardware...');
        
        const promos = [];

        for (const channelUrl of TELEGRAM_CHANNELS) {
            try {
                const response = await fetch(channelUrl);
                if (!response.ok) continue;
                const html = await response.text();

                // Regex para extrair os blocos de mensagem do Telegram
                const blocks = html.split('tgme_widget_message_wrap');

                for (let i = 1; i < blocks.length; i++) {
                    const block = blocks[i];
                    const textMatch = block.match(/<div class="tgme_widget_message_text[^>]*>(.*?)<\/div>/);
                    if (!textMatch) continue;
                    
                    const msgHtml = textMatch[1];
                    const lowerHtml = msgHtml.toLowerCase();
                    
                    // Filtro focado em Peças de PC, PC Montado e Periféricos
                    const pcKeywords = [
                        'pc ', 'computador', 'gamer', 'placa de vídeo', 'placa-mãe', 'placa mãe', 'processador',
                        'ryzen', 'intel', 'core i', 'memória ram', 'ddr4', 'ddr5', 'ssd', 'nvme', 'm.2', 'hd ', 'disco rígido',
                        'gabinete', 'fonte', 'water cooler', 'watercooler', 'air cooler', 'rtx', 'gtx', 'rx ',
                        'radeon', 'nvidia', 'amd', 'mouse', 'teclado', 'headset', 'monitor', 'cadeira gamer',
                        'joystick', 'gamepad', 'controle', 'nintendo switch', 'playstation', 'xbox',
                        'ps4', 'ps5', 'xbox series', 'notebook', 'laptop', 'macbook', 'setup'
                    ];

                    // Ignorar eletrodomésticos, cozinha, higiene (Filtro negativo)
                    const ignoreKeywords = [
                        'liquidificador', 'fritadeira', 'airfryer', 'fralda', 'sabão', 'sabonete', 'shampoo', 
                        'desodorante', 'cafeteira', 'geladeira', 'fogão', 'microondas', 'micro-ondas', 'aspirador', 
                        'ferro de passar', 'perfume', 'maquiagem', 'creme', 'multiprocessador', 'oster', 'batedeira', 
                        'mixer', 'panela', 'forno'
                    ];

                    const isPcOrPeripheral = pcKeywords.some(keyword => lowerHtml.includes(keyword));
                    const shouldIgnore = ignoreKeywords.some(keyword => lowerHtml.includes(keyword));

                    if (!isPcOrPeripheral || shouldIgnore) {
                        continue; // Pula se não for peça de PC/periférico ou se for eletrodoméstico
                    }

                    // Só pegamos ofertas que tenham link das lojas que trabalhamos
                    if (lowerHtml.includes('amzn.to') || lowerHtml.includes('amazon.com') || lowerHtml.includes('link.amazon') || lowerHtml.includes('aliexpress.com') || lowerHtml.includes('ali.ski') || lowerHtml.includes('mercadolivre.com.br') || lowerHtml.includes('meli.la') || lowerHtml.includes('shopee.com.br') || lowerHtml.includes('shope.ee')) {
                        // Extrai os links
                        const allUrls = [...msgHtml.matchAll(/href="(https:\/\/[^"]+)"/g)].map(m => m[1]);
                        if (allUrls.length > 0) {
                            let originalLink = allUrls[0];
                            let secondaryLink = allUrls.length > 1 ? allUrls[1] : undefined;
                            
                            // Para padronizar, se o primeiro for moedas, invertemos (Produto fica primeiro, moedas fica como secundário)
                            if (originalLink.includes('coin-index') && secondaryLink) {
                                const temp = originalLink;
                                originalLink = secondaryLink;
                                secondaryLink = temp;
                            }
                            
                            // Função rápida para limpar HTML entities
                            const decodeHtml = (text: string) => text.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#036;/g, '$');
                            
                            // Extrai o título
                            let rawTitle = msgHtml.split('<br/>')[0].replace(/<[^>]*>?/gm, '').trim();
                            if (!rawTitle || rawTitle.length < 5) rawTitle = "Mega Promoção Gamer!";
                            rawTitle = decodeHtml(rawTitle);

                            // Extrai preços
                            const prices = msgHtml.match(/R(?:\$|&#036;)\s?[\d\.,]+/g);
                            let oldPrice = undefined;
                            let newPrice = undefined;

                            if (prices && prices.length >= 2) {
                                oldPrice = prices[0].replace('&#036;', '$');
                                newPrice = prices[1].replace('&#036;', '$');
                            } else if (prices && prices.length === 1) {
                                newPrice = prices[0].replace('&#036;', '$');
                            }

                            // Extrai Cupom
                            let coupon = undefined;
                            const couponMatch = msgHtml.match(/(?:cupom|código)[:\s]*<[^>]*>([^<]+)/i) || msgHtml.match(/(?:cupom|código)[:\s]*([A-Z0-9]+)/i);
                            if (couponMatch && couponMatch[1]) {
                                coupon = couponMatch[1].trim();
                            }

                            // Extrai instruções (ignorando propagandas do grupo original)
                            let instructions = undefined;
                            const adKeywords = ['nerdofertas.com', 't.me', 'mais grupos', 'mais ofertas', 'nosso grupo', 'nosso canal', 'participe do', 'siga o', 'instagram', 'whatsapp'];
                            const lines = msgHtml.split(/<br\s*\/?>/i).map(l => l.replace(/<[^>]*>?/gm, '').trim()).filter(l => l.length > 0);
                            
                            if (lines.length > 1) {
                                for (let j = 1; j < lines.length; j++) {
                                    const line = lines[j];
                                    const lowLine = line.toLowerCase();
                                    const isAd = adKeywords.some(ad => lowLine.includes(ad));
                                    
                                    if (!lowLine.includes('r$') && !lowLine.includes('http') && !lowLine.includes('cupom') && !isAd) {
                                        instructions = decodeHtml(line);
                                        break;
                                    }
                                }
                            }

                            // Extrai a imagem do produto
                            const imageUrlMatch = block.match(/tgme_widget_message_photo_wrap[^>]+background-image:url\('([^']+)'\)/);
                            let imageBuffer = null;
                            if (imageUrlMatch && imageUrlMatch[1]) {
                                let imgUrl = imageUrlMatch[1];
                                if (imgUrl.startsWith('//')) {
                                    imgUrl = 'https:' + imgUrl;
                                }
                                
                                try {
                                    const imgResponse = await fetch(imgUrl);
                                    if (imgResponse.ok) {
                                        const arrayBuffer = await imgResponse.arrayBuffer();
                                        imageBuffer = Buffer.from(arrayBuffer);
                                    }
                                } catch (e) {
                                    console.error('Erro baixar img do telegram', e);
                                }
                            }

                            promos.push({ link: originalLink, secondaryLink, title: rawTitle, oldPrice, newPrice, coupon, instructions, image: imageBuffer });
                        }
                    }
                }
            } catch (err) {
                console.error(`Erro ao buscar ofertas em ${channelUrl}`, err);
            }
        }

        if (promos.length === 0) {
            console.log('⚠️ [AutoPromo] Nenhuma promoção de Hardware/Gamer encontrada no momento.');
            return;
        }

        const db = await getDb();
        const activeGroups = await getActiveGroups();
        if (activeGroups.length === 0) return;

        // Processa todas as promoções encontradas (da mais antiga para a mais nova)
        for (const promo of promos) {
            // Verifica se já enviamos essa promoção
            try {
                const row = await db.get('SELECT link FROM sent_promos WHERE link = ?', [promo.link]);
                if (row) {
                    continue; // Já enviada, pula pra próxima
                }
            } catch (err) {
                console.error('Erro ao buscar no DB:', err);
                continue;
            }

            // Não foi enviada, então vamos enviar!
            const promoMessage = await generateAffiliateMessage(promo.link, promo.title, promo.oldPrice, promo.newPrice, promo.coupon, promo.instructions, promo.secondaryLink);
            
            console.log(`🚀 [AutoPromo] Disparando nova oferta: ${promo.title}`);
            
            for (const groupId of activeGroups) {
                try {
                    if (promo.image) {
                        await socket.sendMessage(groupId, { image: promo.image, caption: promoMessage });
                    } else {
                        await socket.sendMessage(groupId, { text: promoMessage });
                    }
                    await new Promise(resolve => setTimeout(resolve, 3000)); // Delay anti-ban
                } catch (e) {
                    console.error(`Erro ao enviar promo auto para ${groupId}:`, e);
                }
            }

            // Salva no banco que enviamos
            try {
                await db.run('INSERT INTO sent_promos (link) VALUES (?)', [promo.link]);
            } catch (err2) {
                console.error('Falha ao salvar promo no BD', err2);
            }
        }

    } catch (error) {
        console.error('❌ [AutoPromo] Erro global ao buscar ofertas:', error);
    }
}
