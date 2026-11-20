# Timer Plus

Timer de treino HIIT/Tabata para **Android, iPhone, tablet e navegador**.

## iPhone (funciona agora)

Abra no **Safari** (não no Chrome):

**https://cdn.jsdelivr.net/gh/gabrielmarsaro/timer-plus@main/docs/index.html**

1. Toque em **Compartilhar** (quadrado com seta para cima).  
2. Role e toque em **Adicionar à Tela de Início**.  
3. Confirme **Adicionar**.  
4. Abra o ícone **Timer Plus**.

> Link reserva (se o de cima falhar):  
> https://raw.githack.com/gabrielmarsaro/timer-plus/main/docs/index.html

## Ativar domínio próprio (opcional)

Depois que o Pages estiver ligado, também funciona em:

**https://gabrielmarsaro.github.io/timer-plus/**

1. Abra https://github.com/gabrielmarsaro/timer-plus/settings/pages  
2. **Source** → **Deploy from a branch**  
3. Branch: **main** · pasta: **/docs** · Save  

## Android (APK)

**https://github.com/gabrielmarsaro/timer-plus/raw/main/releases/timer-plus-debug.apk**

1. Abra no Chrome e baixe.  
2. Permita **fontes desconhecidas** se pedir.  
3. Instale.

Página de download: [docs/baixar.html](https://cdn.jsdelivr.net/gh/gabrielmarsaro/timer-plus@main/docs/baixar.html)

## Modos

| Aba | Status |
|-----|--------|
| **Tabata** | Pronto |
| **Rondas** | Pronto |
| Cronómetro | Em breve |
| Mais | Em breve |

## Desenvolvimento

```bash
npm install
npm run dev
npm run build:docs   # atualiza pasta docs/ (site estático)
npm run android:apk  # gera APK
```
