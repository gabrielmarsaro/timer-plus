# Timer Plus

Timer de treino HIIT/Tabata para **Android, iPhone, tablet e navegador**.

## Modos

| Aba | Função |
|-----|--------|
| **Tabata** | Preparar / exercício / descanso com foco na fase ativa |
| **Rondas** | Timer de rounds (boxe/MMA) |
| **Cronómetro** | Contagem crescente com voltas/intervalos |
| **Mais** | Configurações, atalhos e instalação |

## iPhone (Safari)

**https://ethereal-fog-yr5ty2d.shipstatic.com**

1. Abra no **Safari**.  
2. Desative o **mute lateral** e aumente o volume.  
3. **Compartilhar** → **Adicionar à Tela de Início**.

## Android (APK) — versão **1.2.0**

**https://github.com/gabrielmarsaro/timer-plus/raw/main/releases/timer-plus-debug.apk**

1. Baixe no Chrome.  
2. Permita **fontes desconhecidas** se pedir.  
3. Instale / atualize.

Se der erro de pacote/assinatura: desinstale o app antigo e instale de novo.

Página de download: https://ethereal-fog-yr5ty2d.shipstatic.com/baixar.html

## Entrega em todas as plataformas

Toda mudança do app deve atualizar **código + web/iPhone + APK** no mesmo ciclo. Ver `AGENTS.md`.

## Desenvolvimento

```bash
npm install
npm run dev
npm run build:docs
npm run android:apk
npm run smoke
node scripts/smoke-focus.mjs
node scripts/smoke-stopwatch.mjs
```
