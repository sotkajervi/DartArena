// DartArena: allow tournament owner to adjust the random group draw before starting.
(() => {
  const originalRenderGroups = renderGroups;
  let dragged = null;

  function rerender() {
    renderGroups();
  }

  function movePlayer(fromGroup, fromIndex, toGroup, toIndex = null) {
    if (!drawnGroups || !drawnGroups[fromGroup] || !drawnGroups[toGroup]) return;
    const [player] = drawnGroups[fromGroup].splice(fromIndex, 1);
    if (!player) return;
    const target = drawnGroups[toGroup];
    const insertAt = toIndex == null ? target.length : Math.max(0, Math.min(toIndex, target.length));
    target.splice(insertAt, 0, player);
    rerender();
  }

  function playerRow(player, groupIndex, playerIndex) {
    const username = esc(names[player.user_id] || 'Spiller');
    return `<div class="group-drag-player" draggable="true" data-group="${groupIndex}" data-index="${playerIndex}" title="Dra spilleren til ønsket pulje eller plassering">
      <span class="group-drag-handle" aria-hidden="true">☰</span>
      <span class="group-drag-number">${playerIndex + 1}.</span>
      <span class="group-drag-name">${username}${player.test ? ' <em>(test)</em>' : ''}</span>
    </div>`;
  }

  renderGroups = function () {
    if (!drawnGroups) return originalRenderGroups();
    const preview = $('groupPreview');
    preview.innerHTML = `<p class="muted compact group-drag-help">Trekningen er tilfeldig. Dra spillere mellom puljene eller opp/ned før du starter puljespillet.</p>` +
      drawnGroups.map((group, gi) => `<div class="player-row group-drop-zone" data-group="${gi}" style="display:block">
        <div class="player-name" style="color:var(--cyan);margin-bottom:8px">Pulje ${gi + 1} <span class="status">(${group.length})</span></div>
        <div class="group-drop-list" data-group="${gi}">${group.map((p, pi) => playerRow(p, gi, pi)).join('') || '<div class="group-empty">Slipp spiller her</div>'}</div>
      </div>`).join('');

    preview.querySelectorAll('.group-drag-player').forEach(el => {
      el.addEventListener('dragstart', e => {
        dragged = { group: Number(el.dataset.group), index: Number(el.dataset.index) };
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `${dragged.group}:${dragged.index}`);
      });
      el.addEventListener('dragend', () => {
        dragged = null;
        preview.querySelectorAll('.dragging,.drag-over').forEach(x => x.classList.remove('dragging','drag-over'));
      });
      el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
      el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
      el.addEventListener('drop', e => {
        e.preventDefault(); e.stopPropagation();
        if (!dragged) return;
        let toIndex = Number(el.dataset.index);
        const toGroup = Number(el.dataset.group);
        if (dragged.group === toGroup && dragged.index < toIndex) toIndex--;
        movePlayer(dragged.group, dragged.index, toGroup, toIndex);
        dragged = null;
      });
    });

    preview.querySelectorAll('.group-drop-list').forEach(zone => {
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over'); });
      zone.addEventListener('drop', e => {
        e.preventDefault();
        if (!dragged) return;
        movePlayer(dragged.group, dragged.index, Number(zone.dataset.group));
        dragged = null;
      });
    });
  };
})();