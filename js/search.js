const Search = {
  _selectedIndex: -1,
  _debounceTimer: null,

  init() {
    const input = document.getElementById('search-input');

    input.addEventListener('input', () => {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => {
        this._selectedIndex = -1;
        this._suggest(input.value);
      }, 120);
    });

    input.addEventListener('keydown', e => {
      const items = document.querySelectorAll('.suggestion-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._selectedIndex = Math.min(this._selectedIndex + 1, items.length - 1);
        this._updateSelection(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._selectedIndex = Math.max(this._selectedIndex - 1, -1);
        this._updateSelection(items);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (this._selectedIndex >= 0 && items[this._selectedIndex]) {
          items[this._selectedIndex].dispatchEvent(new MouseEvent('mousedown'));
        }
      } else if (e.key === 'Escape') {
        this._hide();
        input.blur();
      }
    });

    document.addEventListener('click', e => {
      if (!e.target.closest('#search-box')) this._hide();
    });
  },

  _suggest(query) {
    const q = query.trim().toLowerCase();
    const box = document.getElementById('search-suggestions');

    if (q.length < 2) { this._hide(); return; }

    if (!App.allFeatures.length) {
      box.innerHTML = '<div class="suggestion-none">Loading features…</div>';
      box.style.display = 'block';
      return;
    }

    const matches = App.allFeatures
      .filter(f => {
        const name = (f.properties.GBR_NAME || f.properties.LOC_NAME_S || '').toLowerCase();
        return name.includes(q);
      })
      .slice(0, 10);

    if (!matches.length) {
      box.innerHTML = '<div class="suggestion-none">No results</div>';
      box.style.display = 'block';
      return;
    }

    box.innerHTML = matches.map(f => {
      const name = f.properties.GBR_NAME || f.properties.LOC_NAME_S || '(unnamed)';
      const type = f.properties.FEAT_NAME || '';
      return `<div class="suggestion-item" data-fid="${f.properties._fid}">
        <span class="suggestion-name">${this._highlight(name, q)}</span>
        <span class="suggestion-type">${this._escape(type)}</span>
      </div>`;
    }).join('');

    box.style.display = 'block';

    box.querySelectorAll('.suggestion-item').forEach(item => {
      // mousedown fires before blur so the dropdown stays visible long enough to register
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        const fid = +item.dataset.fid;
        const feature = App.featuresById.get(fid);
        if (feature) {
          document.getElementById('search-input').value =
            feature.properties.GBR_NAME || feature.properties.LOC_NAME_S || '';
          this._hide();
          App.zoomToFeature(feature);
        }
      });
    });
  },

  _updateSelection(items) {
    items.forEach((el, i) => el.classList.toggle('selected', i === this._selectedIndex));
    if (this._selectedIndex >= 0 && items[this._selectedIndex]) {
      items[this._selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  },

  _hide() {
    const box = document.getElementById('search-suggestions');
    box.innerHTML = '';
    box.style.display = 'none';
    this._selectedIndex = -1;
  },

  _highlight(text, query) {
    const idx = text.toLowerCase().indexOf(query);
    if (idx === -1) return this._escape(text);
    return this._escape(text.slice(0, idx)) +
      '<mark>' + this._escape(text.slice(idx, idx + query.length)) + '</mark>' +
      this._escape(text.slice(idx + query.length));
  },

  _escape(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
