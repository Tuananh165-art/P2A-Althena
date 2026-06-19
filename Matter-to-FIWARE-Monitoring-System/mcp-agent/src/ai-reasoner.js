const axios = require('axios');

/**
 * AI Reasoner — Electrical Fire Risk Analysis
 * Analyzes sensor data for fire risk from climate-driven heat wave overload.
 * Falls back to enhanced rule-based reasoning if no AI endpoint configured.
 */
class AIReasoner {
  constructor() {
    let endpoint = process.env.AI_ENDPOINT || '';
    this.apiKey = process.env.AI_API_KEY || '';
    this.model = process.env.AI_MODEL || 'gpt-4o-mini';
    this.analysisEnabled = process.env.AI_ANALYZE_ENABLED === '1';
    this.chatRequiresAI = process.env.AI_CHAT_REQUIRE_AI === 'true';
    this.disableThinking = process.env.AI_DISABLE_THINKING !== 'false';

    const hasCompletionPath = /\/(chat\/completions|messages|responses)$/i.test(endpoint.replace(/\/+$/, ''));
    if (endpoint && !hasCompletionPath) {
      endpoint = endpoint.replace(/\/+$/, '');
      endpoint += endpoint.endsWith('/v1') ? '/chat/completions' : '/v1/chat/completions';
    }
    this.endpoint = endpoint;
    this.usesMessagesApi = /\/messages$/i.test(this.endpoint);
    this.enabled = !!(this.endpoint && this.apiKey);
    if (this.enabled) {
      console.log(`[AIReasoner] Enabled: ${this.model} via ${this.endpoint}`);
      if (!this.analysisEnabled) {
        console.log('[AIReasoner] Background risk analysis uses rules; AI is reserved for chat');
      }
    } else {
      console.log('[AIReasoner] No AI endpoint configured, using rule-based reasoning');
    }
  }

  async analyzeRisk(metrics, ruleResult) {
    if (!this.enabled || !this.analysisEnabled) {
      return this.enhancedRuleReasoning(metrics, ruleResult);
    }

    try {
      const prompt = this.buildPrompt(metrics, ruleResult);
      const response = await this.postCompletion(
        [
          {
            role: 'system',
            content: 'You are an electrical fire risk analyst. You analyze IoT sensor data (temperature, power consumption, humidity) to detect fire risk caused by climate change-driven heat waves causing electrical overload. Respond ONLY with valid JSON, no other text.'
          },
          { role: 'user', content: prompt }
        ],
        1500,
        0.3,
        parseInt(process.env.AI_ANALYZE_TIMEOUT_MS) || 20000
      );

      const rawContent = this.extractResponseText(response.data);
      return this.parseAIResponse(rawContent, ruleResult);
    } catch (e) {
      console.error(`[AIReasoner] API error: ${e.message}, falling back to rules`);
      return this.enhancedRuleReasoning(metrics, ruleResult);
    }
  }

  buildPrompt(metrics, ruleResult) {
    return `Analyze this IoT sensor data for electrical fire risk:

Temperature: ${metrics.maxTemp?.toFixed(1) || 'N/A'}°C (wiring overheat indicator; warning=40°C, critical=50°C)
Power Consumption: ${metrics.maxPower}W (electrical load; warning=800W, critical=950W)
Humidity: ${metrics.maxHumidity?.toFixed(1)}% (moisture + power = short circuit risk; warning=75%, critical=90%)
Device Active: ${metrics.hasPlugOn}

Context: Climate change causes extreme heat waves → electrical overload → wiring overheat → short circuit → fire.

Current rule-based fire risk assessment:
- Risk Score: ${ruleResult.riskScore}/100
- Risk Level: ${ruleResult.riskLevel}
- Hazard Analysis: ${ruleResult.rationale}

Respond with JSON: {"rationale": "1-2 sentence electrical fire risk explanation", "recommendedActions": ["ACTION1", "ACTION2"], "confidence": 0.0-1.0}`;
  }

  parseAIResponse(content, ruleResult) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        rationale: this.stripMarkdownBold(parsed.rationale || ruleResult.rationale),
        recommendedActions: parsed.recommendedActions || ruleResult.recommendedActions,
        confidence: parsed.confidence || 0.8,
        source: 'ai'
      };
    } catch (e) {
      console.log(`[AIReasoner] Parse fallback to rules: ${e.message}`);
      return this.enhancedRuleReasoning({}, ruleResult);
    }
  }

  async chat(userMessage, context = {}) {
    if (!this.enabled) {
      if (this.chatRequiresAI) {
        throw new Error('AI chat is required but AI_ENDPOINT or AI_API_KEY is not configured');
      }
      if (this.isFastLocalChat(userMessage)) {
        return { text: this.ruleBasedChat(userMessage, context), source: 'rules-fast' };
      }
      return { text: this.ruleBasedChat(userMessage, context), source: 'rules' };
    }

    try {
      if (this.isFastLocalChat(userMessage)) {
        return { text: this.ruleBasedChat(userMessage, context), source: 'rules-fast' };
      }

      const lang = this.detectLanguage(userMessage);
      const systemPrompt = `You are Climate Resilience Claw, a natural Telegram copilot for a climate resilience monitoring system. You help the operator understand electrical fire risk from climate-driven heat waves using IoT data: temperature, power, humidity, device state, alerts, and service health.

Personality and style:
- Sound like a capable teammate, not a command menu.
- Reply naturally and briefly unless the user asks for detail.
- Keep normal chat replies under 6 short lines.
- If the user writes Vietnamese, reply in Vietnamese. If they write English, reply in English.
- Use the live context first. If live data is missing, clearly say you are using demo seed context.
- Do not invent exact sensor values beyond the provided context.
- Mention available actions only when useful: risk check, alerts, system status, simulation, and smart plug control.
- Do not wrap text in double asterisks for markdown bold. Keep the response as plain natural text.

Current system context:
- Zones monitored: ${context.zones?.join(', ') || 'Zone A'}
- Current risk data: ${JSON.stringify(context.risks || [])}
- Active alerts: ${context.alertCount || 0}
- Devices online: ${context.deviceCount || 0}
- Available OpenClaw skills: ${JSON.stringify(context.skills || [])}
- Demo seed context: ${JSON.stringify(context.seedData || {})}

You MUST respond entirely in ${lang}. Be conversational, specific, and reference actual sensor values when available. Give actionable recommendations. Use plain text with short lines or simple bullet points only.`;

      const response = await this.postCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        parseInt(process.env.AI_CHAT_MAX_TOKENS) || 360,
        0.5,
        parseInt(process.env.AI_CHAT_TIMEOUT_MS) || 20000
      );

      const text = this.stripMarkdownBold(this.extractResponseText(response.data) || 'No response from AI.');
      return { text, source: 'ai' };
    } catch (e) {
      console.error(`[AIReasoner] Chat API error: ${e.message}`);
      if (this.chatRequiresAI) {
        throw e;
      }
      return { text: this.ruleBasedChat(userMessage, context), source: 'rules' };
    }
  }

  detectLanguage(text) {
    const lowered = String(text || '').toLowerCase();
    if (/\b(ban|toi|minh|rui ro|canh bao|trang thai|he thong|mo phong|o cam|chay|ten|xin chao|chao)\b/.test(lowered)) return 'Vietnamese (Tieng Viet)';
    if (/[一-鿿]/.test(text)) return 'Chinese (中文)';
    if (/[Ѐ-ӿ]/.test(text)) return 'Russian (Русский)';
    if (/[가-힯]/.test(text)) return 'Korean (한국어)';
    if (/[぀-ゟ゠-ヿ]/.test(text)) return 'Japanese (日本語)';
    // Vietnamese diacritics
    if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text)) return 'Vietnamese (Tiếng Việt)';
    return 'English';
  }

  stripMarkdownBold(text) {
    return String(text || '').replace(/\*\*(.*?)\*\*/g, '$1');
  }

  isFastLocalChat(message) {
    const msg = String(message || '').toLowerCase().trim();
    return /^(hi|hello|hey|alo|chao|xin chao|bạn tên là gì|ban ten la gi|bạn là ai|ban la ai|who are you|what is your name|\?)$/.test(msg) ||
      /\b(ten la gi|ban ten gi|ban la ai|your name|what is your name)\b/.test(msg);
  }

  postCompletion(messages, maxTokens, temperature, timeout) {
    if (this.usesMessagesApi) {
      const system = messages
        .filter(message => message.role === 'system')
        .map(message => message.content)
        .join('\n\n');
      const apiMessages = messages
        .filter(message => message.role !== 'system')
        .map(message => ({
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: message.content
        }));

      const payload = {
        model: this.model,
        system,
        messages: apiMessages,
        max_tokens: maxTokens,
        temperature
      };
      if (this.disableThinking) {
        payload.thinking = { type: 'disabled' };
      }

      return axios.post(
        this.endpoint,
        payload,
        {
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': process.env.AI_ANTHROPIC_VERSION || '2023-06-01',
            'Content-Type': 'application/json'
          },
          timeout
        }
      );
    }

    return axios.post(
      this.endpoint,
      {
        model: this.model,
        messages,
        max_tokens: maxTokens,
        temperature
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout
      }
    );
  }

  extractResponseText(data) {
    const choice = data?.choices?.[0]?.message;
    if (choice?.content || choice?.reasoning_content) {
      return choice.content || choice.reasoning_content;
    }

    if (Array.isArray(data?.content)) {
      const textParts = data.content
        .filter(item => item?.type === 'text' && item.text)
        .map(item => item.text);
      if (textParts.length) return textParts.join('\n');
    }

    if (typeof data?.output_text === 'string') return data.output_text;
    return '';
  }

  ruleBasedChat(message, context, lang = 'English') {
    const msg = message.toLowerCase();
    lang = this.detectLanguage(message);
    const risks = context.risks || [];
    const lines = [];
    const vi = lang.includes('Vietnamese') || /\b(ban|toi|minh|rui ro|canh bao|trang thai|he thong|mo phong|o cam|chay|ten|xin chao|chao)\b/.test(msg);

    if (/\b(hi|hello|hey|xin chao|chao|alo)\b/.test(msg)) {
      return vi
        ? 'Chao ban, minh la OpenClaw, copilot giam sat rui ro chay dien do nang nong va qua tai. Ban co the hoi minh ve rui ro Zone A, canh bao moi nhat, trang thai he thong, mo phong demo, hoac dieu khien o cam thong minh.'
        : 'Hi, I am OpenClaw, the climate resilience copilot for electrical fire-risk monitoring. You can ask about Zone A risk, latest alerts, system health, demo simulations, or smart-plug control.';
    }

    if (/\b(ten la gi|ban ten gi|ban la ai|who are you|your name|what is your name)\b/.test(msg)) {
      return vi
        ? 'Minh la OpenClaw, copilot cua he thong Climate Resilience. Minh theo doi nhiet do, do am, cong suat tai va canh bao rui ro chay dien theo thoi gian thuc.'
        : 'I am OpenClaw, the Climate Resilience copilot. I monitor temperature, humidity, power load, real-time alerts, and electrical fire risk.';
    }

    if (msg.includes('what can you do') || msg.includes('help') || msg.includes('ban co the lam gi') || msg.includes('lam gi duoc')) {
      if (vi) {
        return 'Mình có thể theo dõi rủi ro cháy điện, tóm tắt cảnh báo, kiểm tra trạng thái hệ thống, chạy mô phỏng demo và điều khiển ổ cắm thông minh. Bạn có thể hỏi tự nhiên, ví dụ: "rủi ro hiện tại thế nào?", "có cảnh báo gì không?", hoặc "tắt ổ cắm".';
      }
      return 'I can monitor electrical fire risk, summarize alerts, check system health, run demo scenarios, and control the smart plug. You can ask naturally, for example: "What is the current risk?", "Any alerts?", or "Turn off the smart plug."';
    }

    if (msg.includes('risk') || msg.includes('danger') || msg.includes('safe') || msg.includes('rủi ro') || msg.includes('nguy hiểm') || msg.includes('an toàn') || msg.includes('cháy')) {
      if (vi) {
        lines.push('Tình trạng nguy cơ cháy điện:');
      } else {
        lines.push('Current Fire Risk Status:');
      }
      risks.forEach(r => {
        const emoji = { normal: '✅', warning: '⚠️', critical: '🔴' }[r.riskLevel] || '❓';
        const level = vi ? { normal: 'BÌNH THƯỜNG', warning: 'CẢNH BÁO', critical: 'NGHIÊM TRỌNG' }[r.riskLevel] || 'KHÔNG RÕ' : r.riskLevel?.toUpperCase();
        lines.push(`${emoji} Zone ${r.zone}: ${level} (${r.riskScore}/100)`);
        if (r.rationale) lines.push(`   ${r.rationale}`);
        if (r.metrics) {
          const m = r.metrics;
          if (m.maxTemp) lines.push(vi ? `   🌡️ Nhiệt độ: ${m.maxTemp.toFixed(1)}°C` : `   🌡️ Temperature: ${m.maxTemp.toFixed(1)}°C`);
          if (m.maxPower) lines.push(vi ? `   ⚡ Công suất: ${m.maxPower}W` : `   ⚡ Power: ${m.maxPower}W`);
          if (m.maxHumidity) lines.push(vi ? `   💧 Độ ẩm: ${m.maxHumidity.toFixed(1)}%` : `   💧 Humidity: ${m.maxHumidity.toFixed(1)}%`);
        }
      });
      if (risks.length === 0) lines.push(vi ? 'Chưa có dữ liệu. Kiểm tra cảm biến.' : 'No risk data available. Check that sensors are reporting.');
      return lines.join('\n');
    }

    if (msg.includes('alert') || msg.includes('incident') || msg.includes('cảnh báo') || msg.includes('thông báo')) {
      if (context.alertCount > 0) {
        return vi ? `⚠️ Có ${context.alertCount} cảnh báo trong hệ thống. Xem trang Alerts để biết chi tiết.` : `⚠️ ${context.alertCount} active alert(s) in the system. Check the Alerts page for details.`;
      }
      return vi ? '✅ Không có cảnh báo nào. Hệ thống hoạt động bình thường.' : '✅ No active alerts. System operating normally.';
    }

    if (msg.includes('temp') || msg.includes('heat') || msg.includes('weather') || msg.includes('nhiệt độ') || msg.includes('nóng')) {
      const r = risks[0];
      if (r?.metrics?.maxTemp) {
        const t = r.metrics.maxTemp;
        if (vi) {
          const status = t >= 50 ? '🔴 NGHIÊM TRỌNG — cách điện dây điện nóng chảy, nguy cơ cháy imminent' : t >= 40 ? '⚠️ CẢNH BÁO — nhiệt độ cao gây stress cho cách điện' : '✅ Bình thường';
          return `🌡️ Nhiệt độ: ${t.toFixed(1)}°C\n${status}\nNgưỡng: Cảnh báo=40°C, Nghiêm trọng=50°C`;
        }
        const status = t >= 50 ? '🔴 CRITICAL — wiring insulation melting' : t >= 40 ? '⚠️ WARNING — heat stress on wiring' : '✅ Normal range';
        return `Temperature: ${t.toFixed(1)}°C\n${status}\nThresholds: Warning=40°C, Critical=50°C`;
      }
      return vi ? 'Chưa có dữ liệu nhiệt độ từ cảm biến.' : 'No temperature data available from sensors.';
    }

    if (msg.includes('power') || msg.includes('load') || msg.includes('electric') || msg.includes('công suất') || msg.includes('điện')) {
      const r = risks[0];
      if (r?.metrics?.maxPower) {
        const p = r.metrics.maxPower;
        if (vi) {
          const status = p >= 950 ? '🔴 NGHIÊM TRỌNG — vượt quá dung lượng cầu chì' : p >= 800 ? '⚠️ CẢNH BÁO — tải gần giới hạn' : '✅ Bình thường';
          return `⚡ Công suất: ${p}W\n${status}\nNgưỡng: Cảnh báo=800W, Nghiêm trọng=950W`;
        }
        const status = p >= 950 ? '🔴 CRITICAL — circuit breaker capacity exceeded' : p >= 800 ? '⚠️ WARNING — load near capacity' : '✅ Normal range';
        return `Power Load: ${p}W\n${status}\nThresholds: Warning=800W, Critical=950W`;
      }
      return vi ? 'Chưa có dữ liệu công suất từ cảm biến.' : 'No power consumption data available from sensors.';
    }

    if (msg.includes('system') || msg.includes('health') || msg.includes('status') || msg.includes('hệ thống') || msg.includes('trạng thái')) {
      if (vi) {
        lines.push('Trạng thái hệ thống:');
        lines.push(`• Thiết bị online: ${context.deviceCount || 0}`);
        lines.push(`• Cảnh báo đang active: ${context.alertCount || 0}`);
        lines.push(`• Zone đang giám sát: ${context.zones?.length || 1}`);
        lines.push(`• AI: ${this.enabled ? 'LLM khả dụng' : 'Chỉ dùng rules'}`);
      } else {
        lines.push('System Components:');
        lines.push(`• Devices online: ${context.deviceCount || 0}`);
        lines.push(`• Active alerts: ${context.alertCount || 0}`);
        lines.push(`• Zones monitored: ${context.zones?.length || 1}`);
        lines.push(`• AI source: ${this.enabled ? 'LLM available' : 'Rules only'}`);
      }
      return lines.join('\n');
    }

    if (vi) {
      return `Tôi có thể giúp:\n• Tình trạng nguy cơ cháy ("Rủi ro cháy là bao nhiêu?")\n• Nhiệt độ/Công suất ("Nhiệt độ bao nhiêu?")\n• Cảnh báo ("Có cảnh báo nào không?")\n• Hệ thống ("Kiểm tra trạng thái hệ thống")\n\nThử một trong các nút phía trên!`;
    }
    return `I can help with:\n• Fire risk status ("What's the fire risk?")\n• Temperature/Power readings ("How hot is it?")\n• Alert summary ("Any alerts?")\n• System health ("Check system status")\n\nTry one of the quick action buttons!`;
  }

  enhancedRuleReasoning(metrics, ruleResult) {
    const parts = [];
    const { maxHumidity = 0, maxPower = 0, maxTemp = 0, hasPlugOn = false } = metrics;

    if (ruleResult.riskLevel === 'critical') {
      parts.push(`CRITICAL electrical fire risk detected, score ${ruleResult.riskScore}/100.`);
      if (maxTemp >= 50) {
        parts.push(`Temperature ${maxTemp.toFixed(1)}°C — wiring insulation melting, imminent short circuit and fire.`);
      }
      if (maxPower >= 950) {
        parts.push(`Power ${maxPower}W — circuit breaker capacity exceeded, conductor overheating.`);
      }
      if (maxTemp >= 40 && maxPower >= 800) {
        parts.push('Heat wave compound hazard: extreme ambient heat + electrical overload = cascading fire risk.');
      }
      if (maxHumidity >= 90 && maxPower >= 800) {
        parts.push('Moisture + high current: steam-induced insulation breakdown, arc flash risk.');
      }
    } else if (ruleResult.riskLevel === 'warning') {
      parts.push(`Elevated electrical fire risk, score ${ruleResult.riskScore}/100.`);
      if (maxTemp >= 40) {
        parts.push(`Temperature ${maxTemp.toFixed(1)}°C — heat stress on wiring, monitor for thermal runaway.`);
      }
      if (maxPower >= 800) {
        parts.push(`Power ${maxPower}W — cooling demand driving electrical load near capacity.`);
      }
    } else {
      parts.push('All thermal and electrical indicators within safe range. No fire risk detected.');
    }

    return {
      rationale: parts.join(' '),
      recommendedActions: ruleResult.recommendedActions,
      confidence: 0.95,
      source: 'rules'
    };
  }
}

module.exports = AIReasoner;
