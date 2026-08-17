import { getActiveGroups } from '../database/groupRepository';
import { generateAffiliateMessage } from './affiliateService';
import { getDb } from '../database/db';

const TELEGRAM_CHANNEL = 'https://t.me/s/nerdofertas'; // Canal público de promoções nerd/tech

export async function initAutoPromo(socket: any) {
    // Roda a cada 45 minutos
    setInterval(() => checkAndSendPromo(socket), 45 * 60 * 1000);
    // Executa uma vez no início (com delay de 15s para garantir conexão)
    setTimeout(() => checkAndSendPromo(socket), 15000);
}

async function checkAndSendPromo(socket: any) {
    try {
        console.log('🔄 [AutoPromo] Buscando novas ofertas de tecnologia...');
        
        const response = await fetch(TELEGRAM_CHANNEL);
        const html = await response.text();

        // Regex para extrair os blocos de mensagem do Telegram
        const messageRegex = /<div class="tgme_widget_message_text[^>]*>(.*?)<\/div>/g;
        let match;
        const promos = [];

        while ((match = messageRegex.exec(html)) !== null) {
            const msgHtml = match[1];
            
            // Só pegamos ofertas que tenham link da Amazon (para garantir a conversão fácil da sua tag)
            if (msgHtml.includes('amzn.to') || msgHtml.includes('amazon.com') || msgHtml.includes('link.amazon')) {
                // Extrai o primeiro link
                const urlMatch = msgHtml.match(/href="(https:\/\/[^"]+)"/);
                if (urlMatch) {
                    const originalLink = urlMatch[1];
                    
                    // Extrai o título (normalmente é o primeiro texto antes do primeiro <br/>)
                    let rawTitle = msgHtml.split('<br/>')[0].replace(/<[^>]*>?/gm, '').trim();
                    if (!rawTitle || rawTitle.length < 5) rawTitle = "Mega Promoção de Tecnologia!";

                    // Extrai preço (tenta achar R$ XX,XX)
                    const priceMatch = msgHtml.match(/R\$\s?[\d\.,]+/);
                    const rawPrice = priceMatch ? priceMatch[0] : "Preço Especial";

                    promos.push({ link: originalLink, title: rawTitle, price: rawPrice });
                }
            }
        }

        if (promos.length === 0) {
            console.log('⚠️ [AutoPromo] Nenhuma promoção da Amazon encontrada no momento.');
            return;
        }

        // Pega a última (a mais recente do canal de Telegram)
        const latestPromo = promos[promos.length - 1];

        const db = await getDb();

        // Verifica se já enviamos essa promoção hoje
        try {
            const row = await db.get('SELECT link FROM sent_promos WHERE link = ?', [latestPromo.link]);
            
            if (row) {
                console.log('⏳ [AutoPromo] A última promoção já foi enviada. Aguardando a próxima.');
                return;
            }
        } catch (err) {
            console.error('Erro ao buscar no DB:', err);
        }

        // Não foi enviada, então vamos enviar!
        const promoMessage = await generateAffiliateMessage(latestPromo.link, latestPromo.title, latestPromo.price);
        const activeGroups = await getActiveGroups();

        if (activeGroups.length === 0) return;

        console.log(`🚀 [AutoPromo] Disparando nova oferta: ${latestPromo.title}`);
        
        for (const groupId of activeGroups) {
            try {
                await socket.sendMessage(groupId, { text: promoMessage });
                await new Promise(resolve => setTimeout(resolve, 3000)); // Delay anti-ban
            } catch (e) {
                console.error(`Erro ao enviar promo auto para ${groupId}:`, e);
            }
        }

        // Salva no banco que enviamos
        try {
            await db.run('INSERT INTO sent_promos (link) VALUES (?)', [latestPromo.link]);
        } catch (err2) {
            console.error('Falha ao salvar promo no BD', err2);
        }

    } catch (error) {
        console.error('❌ [AutoPromo] Erro ao buscar ofertas:', error);
    }
}
