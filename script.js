// Configurações do Repositório GitHub
const REPO_OWNER = 'MatheuZera';
const REPO_NAME = 'Marketplace-Hub';
const FILE_PATH = 'cloud/items.json';

// Utilizando GH_TOKEN conforme o secret configurado no repositório

let ITEMS = [];
let fileSha = ''; // Armazena o hash do arquivo para permitir atualizações
let activeCategory = 'tudo';
let searchQuery = '';

const CATEGORIES = [
   { id: 'tudo', label: 'Tudo' },
   { id: 'mundos', label: 'Mundos' },
   { id: 'addons', label: 'Addons' },
   { id: 'mods', label: 'Mods' },
   { id: 'estruturas', label: 'Estruturas' },
   { id: 'skins', label: 'Skins' },
   { id: 'skin-packs', label: 'Skin-Packs' },
   { id: 'servidores', label: 'Servidores' }
];

// --- 1. COMUNICAÇÃO COM A NUVEM (GITHUB API) ---

const decodeB64 = (str) => decodeURIComponent(escape(atob(str)));
const encodeB64 = (str) => btoa(unescape(encodeURIComponent(str)));

async function fetchItemsFromGitHub() {
    if (typeof GH_TOKEN === 'undefined') {
        console.error("Erro: GH_TOKEN não definido. Verifique a importação do token gerado pela Action.");
        return;
    }

    const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    
    try {
        const response = await fetch(apiUrl, {
            headers: { 
                'Authorization': `Bearer ${GH_TOKEN}`, 
                'Accept': 'application/vnd.github.v3+json' 
            }
        });

        if (response.ok) {
            const data = await response.json();
            fileSha = data.sha;
            const content = decodeB64(data.content);
            const allItems = JSON.parse(content);
            ITEMS = allItems.filter(item => item.approved === true);
        } else if (response.status === 404) {
            console.warn("Arquivo items.json ainda não existe na nuvem. Será criado no primeiro envio.");
            ITEMS = [];
        } else {
            throw new Error(`Falha ao buscar dados: ${response.status}`);
        }
    } catch (error) {
        console.error("Erro ao carregar itens da nuvem:", error);
        ITEMS = [];
    }
}

async function saveItemToGitHub(newItem) {
    if (typeof GH_TOKEN === 'undefined') throw new Error("Token ausente");

    newItem.approved = true; 
    const updatedList = [newItem, ...ITEMS]; 
    
    const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    const updatedContent = encodeB64(JSON.stringify(updatedList, null, 2));

    const payload = {
        message: `Adicionando item: ${newItem.title}`,
        content: updatedContent,
        branch: 'main'
    };
    if (fileSha) payload.sha = fileSha;

    const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${GH_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
    }

    const responseData = await response.json();
    fileSha = responseData.content.sha;
    ITEMS = updatedList;
    renderGrid();
}

// --- 2. INICIALIZAÇÃO E UI ---

document.addEventListener('DOMContentLoaded', async () => {
   await fetchItemsFromGitHub();
   renderCategories();
   renderGrid();
   setupSearch();
   setupCreateForm();
});

function renderCategories() {
   const container = document.getElementById('category-filters');
   if (!container) return;

   container.innerHTML = CATEGORIES.map(cat => `
      <button 
         onclick="setCategory('${cat.id}')"
         class="whitespace-nowrap font-bold text-xs uppercase px-4 py-2 rounded-md transition-colors cursor-pointer ${
            activeCategory === cat.id 
            ? 'bg-mc-green text-white' 
            : 'bg-mc-card border border-mc-border text-mc-muted hover:text-white hover:bg-[#222]'
         }"
      >
         ${cat.label}
      </button>
   `).join('');
}

window.setCategory = (id) => {
   activeCategory = id;
   renderCategories();
   renderGrid();
};

function setupSearch() {
   const input = document.getElementById('search-input');
   if (!input) return;

   input.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderGrid();
   });
}

function renderGrid() {
  const grid = document.getElementById('marketplace-grid');
  if (!grid) return;

  const filtered = ITEMS.filter(item => {
     const matchCat = activeCategory === 'tudo' || item.category === activeCategory;
     const matchSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || item.author.toLowerCase().includes(searchQuery.toLowerCase());
     return matchCat && matchSearch;
  });

  if (filtered.length === 0) {
     grid.innerHTML = `
        <div class="col-span-1 sm:col-span-2 lg:col-span-4 py-20 flex flex-col items-center justify-center text-center border border-dashed border-mc-border rounded-xl bg-mc-card/50">
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-12 h-12 text-mc-border mb-4"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
           <h3 class="font-bold text-xl text-white mb-2 uppercase">Nenhum resultado encontrado</h3>
           <p class="text-mc-muted text-sm font-medium mb-4">Nenhum item cadastrado nesta categoria.</p>
           <button onclick="openCreateModal()" class="bg-mc-green hover:bg-mc-green-hover text-white font-bold px-4 py-2 rounded text-xs uppercase transition-colors cursor-pointer">Adicionar Novo Item</button>
        </div>
     `;
     return;
  }

  grid.innerHTML = filtered.map((item, index) => {
     const isFeatured = index === 0 && activeCategory === 'tudo' && !searchQuery;
     const containerClasses = isFeatured 
        ? "col-span-1 sm:col-span-2 lg:col-span-2 row-span-2 min-h-[400px]" 
        : "col-span-1 min-h-[220px]";
     
     const bgBlur = item.isCoins ? 'bg-purple-600' : 'bg-cyan-600';
     const badgeColor = item.category === 'mundos' ? 'bg-[#38AD1B]' : 
                        item.category === 'skins' || item.category === 'skin-packs' ? 'bg-purple-600' : 
                        item.category === 'addons' ? 'bg-orange-600' : 
                        item.category === 'servidores' ? 'bg-cyan-600' : 
                        item.category === 'estruturas' ? 'bg-yellow-600' : 'bg-pink-600';

     if (isFeatured) {
        return `
        <div onclick="openModal('${item.id}')" class="${containerClasses} bg-mc-card rounded-xl border border-mc-border overflow-hidden relative group cursor-pointer transition-transform hover:-translate-y-1 hover:border-mc-green">
          <div class="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10"></div>
          <div class="absolute inset-0 bg-[#222] transition-transform duration-700 group-hover:scale-105" style="background-image: url('${item.image}'); background-size: cover; background-position: center;"></div>
          <div class="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
             <div class="text-white text-[6rem] sm:text-[8rem] font-bold italic opacity-10 uppercase tracking-tighter mix-blend-overlay">FEATURED</div>
          </div>
          <div class="absolute bottom-0 left-0 p-6 md:p-8 z-20 w-full">
            <div class="flex gap-2 mb-3">
              <span class="${badgeColor} px-3 py-1 rounded text-[10px] font-bold uppercase text-white">${item.type}</span>
              <span class="bg-blue-600 px-3 py-1 rounded text-[10px] font-bold uppercase text-white">Trending</span>
            </div>
            <h2 class="text-3xl md:text-4xl font-black mb-2 uppercase leading-none text-white">${item.title}</h2>
            <p class="text-gray-300 text-sm max-w-md mb-6 line-clamp-2">${item.desc}</p>
            <div class="flex flex-wrap items-center gap-4 justify-between">
              <button class="bg-white text-black hover:bg-gray-200 transition-colors font-bold px-6 py-3 rounded uppercase text-sm cursor-pointer">
                Ver Detalhes
              </button>
              <div class="flex gap-4 text-white">
                <div class="text-center">
                  <div class="text-lg font-bold">${item.rating}</div>
                  <div class="text-[10px] text-gray-400 uppercase font-bold">Rating</div>
                </div>
                <div class="text-center">
                  <div class="text-lg font-bold">${item.plays || '1'}</div>
                  <div class="text-[10px] text-gray-400 uppercase font-bold">Plays</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        `;
     }

     return `
     <div onclick="openModal('${item.id}')" class="${containerClasses} bg-mc-card rounded-xl border border-mc-border p-5 flex flex-col justify-between relative overflow-hidden transition-transform hover:-translate-y-1 hover:border-mc-green group cursor-pointer">
        <div class="absolute -right-10 -top-10 w-32 h-32 blur-3xl opacity-20 transition-opacity group-hover:opacity-40 ${bgBlur}"></div>
        <div class="flex justify-between items-start z-10">
           <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-white ${badgeColor}">${item.type}</span>
           <div class="flex items-center gap-1 font-bold text-mc-gold text-sm">
              ${item.isCoins ? '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3 fill-current"><path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13"/><path d="M13 3l3 6-4 13"/></svg>' : ''}
              ${item.price}
           </div>
        </div>
        <div class="mt-6 mb-4 z-10 flex-1">
           <h3 class="text-lg font-bold uppercase leading-tight text-white line-clamp-2">${item.title}</h3>
           <div class="flex items-center gap-1 mt-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3 text-mc-gold fill-current"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <p class="text-xs text-gray-500 font-bold">${item.rating}</p>
           </div>
        </div>
        <div class="mt-auto flex items-center justify-between z-10">
           <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded bg-[#111] border border-[#333] overflow-hidden flex items-center justify-center">
                 <div class="w-full h-full bg-[#333]" style="background-image: url('${item.image}'); background-size: cover; background-position: center;"></div>
              </div>
              <div class="text-[10px] text-gray-400 font-bold uppercase">Por <span class="text-white">${item.author}</span></div>
           </div>
           ${item.category === 'servidores' ? `
           <div class="flex items-center gap-1">
              <div class="w-2 h-2 bg-green-500 rounded-full"></div>
              <span class="text-[10px] text-green-500 font-bold">ONLINE</span>
           </div>
           ` : ''}
        </div>
     </div>
     `;
  }).join('');
}

// --- 3. MODAIS E FORMULÁRIO ---

window.openModal = (id) => {
   const item = ITEMS.find(i => i.id === id);
   if (!item) return;

   const modal = document.getElementById('details-modal');
   const modalBox = document.getElementById('modal-content-box');
   if(!modal || !modalBox) return;

   modalBox.innerHTML = `
      <div class="flex-1 min-h-[300px] md:min-h-0 relative bg-black flex items-center justify-center overflow-hidden">
         <div class="absolute inset-0 w-full h-full opacity-30 blur-sm" style="background-image: url('${item.image}'); background-size: cover; background-position: center;"></div>
         <div class="relative z-10 w-full h-full min-h-[300px]" style="background-image: url('${item.image}'); background-size: cover; background-position: center;"></div>
      </div>
      <div class="flex-1 p-8 flex flex-col relative z-20 bg-mc-card">
         <div class="flex items-center gap-2 mb-4">
            <span class="bg-mc-green px-2 py-1 rounded text-[10px] font-bold uppercase text-white">${item.type}</span>
         </div>
         <h2 class="text-3xl font-black uppercase text-white mb-2">${item.title}</h2>
         <p class="text-mc-muted mb-6 font-bold uppercase text-xs">Por <span class="text-white">${item.author}</span></p>
         <p class="text-gray-300 mb-8 leading-relaxed">${item.desc}</p>
         
         <div class="mt-auto flex items-center justify-between border-t border-mc-border pt-6">
            <div class="text-3xl font-black text-mc-gold flex items-center gap-2">
               ${item.isCoins ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8 fill-current"><path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13"/><path d="M13 3l3 6-4 13"/></svg>` : ''}
               ${item.price}
            </div>
            <button onclick="window.downloadItem('${item.id}')" class="bg-mc-green hover:bg-mc-green-hover text-white font-bold px-8 py-4 rounded uppercase transition-colors flex items-center gap-2 cursor-pointer shadow-[0_4px_0_#1B540D] hover:-translate-y-1">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg> ${item.category === 'servidores' ? 'Conectar' : 'Baixar'}
            </button>
         </div>
      </div>
      <button onclick="window.closeModal()" class="absolute top-4 right-4 text-white hover:text-red-500 bg-black/50 rounded-md p-2 z-50 transition-colors cursor-pointer border border-white/10">
         <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
   `;

   modal.classList.remove('hidden');
   modal.classList.add('flex');
   setTimeout(() => { modal.classList.remove('opacity-0'); modalBox.classList.remove('scale-95'); }, 10);
};

window.closeModal = () => {
   const modal = document.getElementById('details-modal');
   const modalBox = document.getElementById('modal-content-box');
   if(!modal || !modalBox) return;

   modal.classList.add('opacity-0');
   modalBox.classList.add('scale-95');
   setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
};

window.openCreateModal = () => {
   const modal = document.getElementById('create-modal');
   if(!modal) return;
   modal.classList.remove('hidden');
   modal.classList.add('flex');
   setTimeout(() => modal.classList.remove('opacity-0'), 10);
};

window.closeCreateModal = () => {
   const modal = document.getElementById('create-modal');
   if(!modal) return;
   modal.classList.add('opacity-0');
   setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
};

function setupCreateForm() {
   const form = document.getElementById('create-form');
   if(!form) return;

   form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitBtn = document.getElementById('submit-btn');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Enviando para Nuvem...';
      submitBtn.disabled = true;

      try {
         const newItem = {
            id: Date.now().toString(),
            title: document.getElementById('item-title').value,
            author: document.getElementById('item-author').value,
            category: document.getElementById('item-category').value,
            type: document.getElementById('item-type').value.toUpperCase(),
            price: document.getElementById('item-price').value,
            isCoins: document.getElementById('item-is-coins').checked,
            rating: parseFloat(document.getElementById('item-rating').value) || 5.0,
            plays: '1',
            image: document.getElementById('item-image').value,
            desc: document.getElementById('item-desc').value
         };

         await saveItemToGitHub(newItem);

         closeCreateModal();
         form.reset();
         showToast('Item sincronizado com sucesso no GitHub!');
      } catch (error) {
         console.error(error);
         alert('Erro ao salvar no GitHub: ' + error.message);
      } finally {
         submitBtn.textContent = originalText;
         submitBtn.disabled = false;
      }
   });
}

window.downloadItem = (id) => {
   window.closeModal();
   showToast('Download iniciado com sucesso!');
};

function showToast(message) {
   const toast = document.getElementById('toast');
   const toastMsg = document.getElementById('toast-msg');
   if(!toast) return;

   if(toastMsg) toastMsg.textContent = message;
   toast.classList.remove('translate-y-20', 'opacity-0');
   
   setTimeout(() => {
      toast.classList.add('translate-y-20', 'opacity-0');
   }, 3500);
}
