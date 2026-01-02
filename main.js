const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 800;

class MockupScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MockupScene' });

        this.shirtParts = { front: {}, back: {} };
        // TAMBAHAN: Properti untuk menyimpan outline
        this.shirtOutlines = { front: null, back: null };
        this.artworks = { front: { torso: null, sleeve: null }, back: { torso: null, sleeve: null } };
        this.currentView = 'front';
        this.isEditMode = true;
        this.selectedArt = null;

        // Zoom and pan variables
        this.zoomLevel = 1;
        this.minZoom = 0.3;
        this.maxZoom = 3;
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };

        // Unified transform state
        this.transformState = {
            isTransforming: false,
            mode: null, // 'drag', 'scale', 'rotate'
            initialPointerPos: new Phaser.Math.Vector2(),
            initialArtPos: new Phaser.Math.Vector2(),
            initialArtScale: new Phaser.Math.Vector2(),
            initialArtRotation: 0,
            initialDistance: 0,
            initialAngle: 0
        };
        this.transformControls = null;
    }

    preload() {
        this.load.image('shirt-front-torso', 'ImageAssets/Front/shirt-front-torso.png');
        this.load.image('shirt-front-sleeve', 'ImageAssets/Front/shirt-front-sleeve.png');
        this.load.image('shirt-back-torso', 'ImageAssets/Back/shirt-back-torso.png');
        this.load.image('shirt-back-sleeve', 'ImageAssets/Back/shirt-back-sleeve.png');

        // TAMBAHAN: Preload gambar outline
        this.load.image('shirt-front-outline', 'ImageAssets/Front/shirt-front-outline.png');
        this.load.image('shirt-back-outline', 'ImageAssets/Back/shirt-back-outline.png');
    }

    create() {
        this.cameras.main.setBackgroundColor('#f0f0f0');
        this.cameras.main.centerOn(0, 0);

        this.frontContainer = this.add.container(0, 0);
        this.backContainer = this.add.container(0, 0).setVisible(false);

        // --- Create Shirt Parts ---
        this.shirtParts.front.torso = this.add.sprite(0, 0, 'shirt-front-torso').setOrigin(0.5);
        this.shirtParts.front.sleeve = this.add.sprite(0, 0, 'shirt-front-sleeve').setOrigin(0.5);
        this.frontContainer.add([this.shirtParts.front.torso, this.shirtParts.front.sleeve]);

        this.shirtParts.back.torso = this.add.sprite(0, 0, 'shirt-back-torso').setOrigin(0.5);
        this.shirtParts.back.sleeve = this.add.sprite(0, 0, 'shirt-back-sleeve').setOrigin(0.5);
        this.backContainer.add([this.shirtParts.back.torso, this.shirtParts.back.sleeve]);

        // --- TAMBAHAN: Create Shirt Outlines ---
        this.shirtOutlines.front = this.add.sprite(0, 0, 'shirt-front-outline').setOrigin(0.5);
        this.shirtOutlines.back = this.add.sprite(0, 0, 'shirt-back-outline').setOrigin(0.5);

        // Non-aktifkan interaksi agar tidak menghalangi input mouse/touch
        this.shirtOutlines.front.disableInteractive();
        this.shirtOutlines.back.disableInteractive();

        // Tambahkan ke container masing-masing
        this.frontContainer.add(this.shirtOutlines.front);
        this.backContainer.add(this.shirtOutlines.back);


        this.setupUIListeners();
        this.setupCameraControls();
        this.setupTransformHandlers();

        this.addZoomResetButton();
        this.addFloatingTransformHint();
        
        // Deselect when clicking outside
        this.input.on('pointerdown', (pointer, gameObjects) => {
            // If the left mouse button is clicked and it's not over any interactive game objects,
            // and something is currently selected, then deselect it.
            if (pointer.leftButtonDown() && gameObjects.length === 0 && this.selectedArt) {
                // We check 'isTransforming' to prevent deselecting while dragging a handle just off the art.
                if (!this.transformState.isTransforming) {
                    this.deselectArt();
                }
            }
        });
    }

    setupUIListeners() {
        document.getElementById('front-view-btn').addEventListener('click', () => this.switchView('front'));
        document.getElementById('back-view-btn').addEventListener('click', () => this.switchView('back'));
        document.getElementById('edit-mode-btn').addEventListener('click', () => this.setMode(true));
        document.getElementById('preview-mode-btn').addEventListener('click', () => this.setMode(false));
        document.getElementById('color-picker').addEventListener('input', (e) => this.changeShirtColor(e.target.value));
        document.getElementById('torso-art-upload').addEventListener('change', (e) => this.handleArtUpload(e, 'torso'));
        document.getElementById('sleeve-art-upload').addEventListener('change', (e) => this.handleArtUpload(e, 'sleeve'));
        document.getElementById('delete-art-btn').addEventListener('click', () => this.deleteSelectedArt());
        document.getElementById('print-pdf-btn').addEventListener('click', () => this.printToPDF());
    }

    setupCameraControls() {
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            const newZoom = this.zoomLevel - deltaY * 0.001;
            this.setZoomLevel(newZoom);
        });

        this.input.on('pointerdown', (pointer) => {
            if (pointer.button === 1) { // Middle mouse button
                this.isPanning = true;
                this.panStart.x = pointer.x;
                this.panStart.y = pointer.y;
            }
        });

        this.input.on('pointermove', (pointer) => {
            if (this.isPanning && pointer.middleButtonDown()) {
                const dx = pointer.x - this.panStart.x;
                const dy = pointer.y - this.panStart.y;
                this.cameras.main.scrollX -= dx / this.zoomLevel;
                this.cameras.main.scrollY -= dy / this.zoomLevel;
                this.panStart.x = pointer.x;
                this.panStart.y = pointer.y;
            }
        });

        this.input.on('pointerup', (pointer) => {
            if (pointer.button === 1) {
                this.isPanning = false;
            }
        });
    }

    setupTransformHandlers() {
        this.input.on('pointerdown', (pointer) => {
            if (!this.selectedArt || !this.isEditMode || pointer.button !== 0) return;

            const art = this.selectedArt;
            const controls = this.transformControls;
            const worldPoint = pointer.positionToCamera(this.cameras.main);

            const scaleHandle = controls.getByName('scaleHandle');
            const rotateHandle = controls.getByName('rotateHandle');
            
            // Convert handle positions to world space for hit-testing
            const matrix = controls.getWorldTransformMatrix();
            const scaleHandleWorldPos = new Phaser.Math.Vector2();
            matrix.transformPoint(scaleHandle.x, scaleHandle.y, scaleHandleWorldPos);

            const rotateHandleWorldPos = new Phaser.Math.Vector2();
             matrix.transformPoint(rotateHandle.x, rotateHandle.y, rotateHandleWorldPos);

            const handleSize = scaleHandle.width / this.cameras.main.zoom;

            // Check if pointer is on a handle
            if (Phaser.Math.Distance.Between(worldPoint.x, worldPoint.y, scaleHandleWorldPos.x, scaleHandleWorldPos.y) < handleSize) {
                this.transformState.mode = 'scale';
            } else if (Phaser.Math.Distance.Between(worldPoint.x, worldPoint.y, rotateHandleWorldPos.x, rotateHandleWorldPos.y) < handleSize) {
                this.transformState.mode = 'rotate';
            } else if (art.getBounds().contains(worldPoint.x, worldPoint.y)) {
                this.transformState.mode = 'drag';
            } else {
                return; // Clicked outside
            }

            this.transformState.isTransforming = true;
            this.transformState.initialPointerPos.copy(worldPoint);
            this.transformState.initialArtPos.copy(art.parentContainer.pointToContainer(art));
            this.transformState.initialArtScale.set(art.scaleX, art.scaleY);
            this.transformState.initialArtRotation = art.rotation;

            // For scale/rotate calculations
            this.transformState.initialDistance = Phaser.Math.Distance.Between(art.x, art.y, worldPoint.x, worldPoint.y);
            this.transformState.initialAngle = Phaser.Math.Angle.Between(art.x, art.y, worldPoint.x, worldPoint.y);
        });

        this.input.on('pointermove', (pointer) => {
            if (!this.transformState.isTransforming || !this.selectedArt) return;

            const art = this.selectedArt;
            const worldPoint = pointer.positionToCamera(this.cameras.main);

            switch (this.transformState.mode) {
                case 'drag':
                    const dx = worldPoint.x - this.transformState.initialPointerPos.x;
                    const dy = worldPoint.y - this.transformState.initialPointerPos.y;
                    art.setPosition(this.transformState.initialArtPos.x + dx, this.transformState.initialArtPos.y + dy);
                    break;
                    
                case 'scale':
                    const currentDistance = Phaser.Math.Distance.Between(art.x, art.y, worldPoint.x, worldPoint.y);
                    let scaleFactor = currentDistance / this.transformState.initialDistance;
                    if (isNaN(scaleFactor) || scaleFactor === 0) scaleFactor = 1;
                    const newScale = Math.max(0.1, this.transformState.initialArtScale.x * scaleFactor);
                    art.setScale(newScale);
                    break;

                case 'rotate':
                    const currentAngle = Phaser.Math.Angle.Between(art.x, art.y, worldPoint.x, worldPoint.y);
                    const angleDiff = currentAngle - this.transformState.initialAngle;
                    art.setRotation(this.transformState.initialArtRotation + angleDiff);
                    break;
            }
            this.updateTransformControls();
        });

        this.input.on('pointerup', () => {
            this.transformState.isTransforming = false;
            this.transformState.mode = null;
        });
    }
    
    addArtToShirt(key, part) {
        if (this.artworks[this.currentView][part]) {
            this.artworks[this.currentView][part].destroy();
            this.deselectArt();
        }

        const art = this.add.image(0, 0, key).setInteractive();
        art.setData({ part: part, view: this.currentView, key: key });

        const maskSource = this.shirtParts[this.currentView][part];
        const mask = maskSource.createBitmapMask();
        art.setMask(mask);

        this.artworks[this.currentView][part] = art;
        const container = this.currentView === 'front' ? this.frontContainer : this.backContainer;
        container.add(art);

        // TAMBAHAN: Pastikan outline selalu di atas art, tapi di bawah transform controls
        container.bringToTop(this.shirtOutlines[this.currentView]);

        art.on('pointerdown', (pointer) => {
            if (this.isEditMode && pointer.button === 0) {
                this.selectArt(art);
                pointer.event.stopPropagation();
            }
        });
        
        this.selectArt(art); // Auto-select new art
    }

    selectArt(art) {
        if (this.selectedArt === art) return;
        this.deselectArt();
        this.selectedArt = art;
        this.createTransformControls(art);
        document.getElementById('delete-art-btn').disabled = false;
    }

    deselectArt() {
        if (this.transformControls) {
            this.transformControls.destroy();
            this.transformControls = null;
        }
        this.selectedArt = null;
        document.getElementById('delete-art-btn').disabled = true;
    }

    createTransformControls(art) {
        if (this.transformControls) this.transformControls.destroy();

        this.transformControls = this.add.container(art.x, art.y);
        this.transformControls.setRotation(art.rotation);

        const bounds = this.add.graphics().setName('bounds');
        const scaleHandle = this.add.rectangle(0, 0, 10, 10, 0x4285F4).setName('scaleHandle');
        const rotateHandle = this.add.circle(0, 0, 6, 0xEA4335).setName('rotateHandle');
        const rotationIcon = this.add.text(0, 0, '↻', { fontSize: '12px', fill: '#FFFFFF' }).setName('rotationIcon').setOrigin(0.5);
        
        this.transformControls.add([bounds, scaleHandle, rotateHandle, rotationIcon]);
        
        const container = this.currentView === 'front' ? this.frontContainer : this.backContainer;
        container.add(this.transformControls);
        // Pastikan controls selalu di paling atas
        container.bringToTop(this.transformControls);
        
        this.updateTransformControls();
    }

    updateTransformControls() {
        if (!this.transformControls || !this.selectedArt) return;

        const art = this.selectedArt;
        const controls = this.transformControls;

        controls.setPosition(art.x, art.y).setRotation(art.rotation);

        const zoom = this.cameras.main.zoom;
        const handleSize = 16 / zoom;
        const halfW = (art.displayWidth / 2);
        const halfH = (art.displayHeight / 2);

        const bounds = controls.getByName('bounds');
        bounds.clear().lineStyle(2 / zoom, 0x4285F4, 1);
        bounds.strokeRect(-halfW, -halfH, art.displayWidth, art.displayHeight);

        const scaleHandle = controls.getByName('scaleHandle');
        scaleHandle.setPosition(halfW, halfH).setSize(handleSize, handleSize).setOrigin(0.5);

        const rotateHandlePos = new Phaser.Math.Vector2(0, -halfH - (20 / zoom));
        const rotateHandle = controls.getByName('rotateHandle');
        rotateHandle.setPosition(rotateHandlePos.x, rotateHandlePos.y).setRadius(handleSize * 0.4);
        
        const rotationIcon = controls.getByName('rotationIcon');
        rotationIcon.setPosition(rotateHandlePos.x, rotateHandlePos.y).setFontSize(12 / zoom);
    }
    
    // --- Unchanged Helper Functions ---

    setZoomLevel(zoom) {
        this.zoomLevel = Phaser.Math.Clamp(zoom, this.minZoom, this.maxZoom);
        this.cameras.main.setZoom(this.zoomLevel);
        this.updateTransformControls();
    }

    resetView() {
        this.setZoomLevel(1);
        this.cameras.main.centerOn(0, 0);
    }

    switchView(view) {
        this.currentView = view;
        this.frontContainer.setVisible(view === 'front');
        this.backContainer.setVisible(view === 'back');
        document.getElementById('front-view-btn').classList.toggle('active', view === 'front');
        document.getElementById('back-view-btn').classList.toggle('active', view === 'back');
        this.deselectArt();
        this.resetView();
    }

    setMode(isEdit) {
        this.isEditMode = isEdit;
        document.getElementById('edit-mode-btn').classList.toggle('active', isEdit);
        document.getElementById('preview-mode-btn').classList.toggle('active', !isEdit);
        document.getElementById('edit-controls').style.display = isEdit ? 'block' : 'none';
        if (!isEdit) {
            this.deselectArt();
        }
    }

    changeShirtColor(colorHex) {
        const color = Phaser.Display.Color.HexStringToColor(colorHex).color;
        ['front', 'back'].forEach(view => {
            this.shirtParts[view].torso.setTint(color);
            this.shirtParts[view].sleeve.setTint(color);
        });
    }

    handleArtUpload(event, part) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const key = `art_${this.currentView}_${part}_${Date.now()}`;
            this.load.image(key, e.target.result);
            this.load.once(`filecomplete-image-${key}`, () => {
                this.addArtToShirt(key, part);
            });
            this.load.start();
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    }

    deleteSelectedArt() {
        if (this.selectedArt) {
            const { view, part } = this.selectedArt.data.values;
            this.artworks[view][part] = null;
            this.selectedArt.destroy();
            this.deselectArt();
        }
    }
    
    addZoomResetButton() {
        const phaserContainer = document.getElementById('phaser-container');
        if (phaserContainer.querySelector('.zoom-reset-btn')) return;
        const resetButton = document.createElement('button');
        resetButton.textContent = 'Reset View';
        resetButton.className = 'zoom-reset-btn';
        // Apply styles via JS
        Object.assign(resetButton.style, {
            position: 'absolute', top: '10px', left: '10px', zIndex: '1000',
            padding: '8px 12px', backgroundColor: '#007bff', color: 'white',
            border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px'
        });
        resetButton.addEventListener('click', () => this.resetView());
        phaserContainer.appendChild(resetButton);
    }

    addFloatingTransformHint() {
        const phaserContainer = document.getElementById('phaser-container');
        if (phaserContainer.querySelector('.transform-hint')) return;
        const hint = document.createElement('div');
        hint.className = 'transform-hint';
        hint.innerHTML = `
            <h4>Transform Controls</h4>
            <ul>
                <li><strong>Drag:</strong> Move selected art</li>
                <li><strong>Corner Handle:</strong> Drag to scale</li>
                <li><strong>Top Handle:</strong> Drag to rotate</li>
            </ul>`;
         Object.assign(hint.style, {
            position: 'absolute', bottom: '10px', right: '10px', zIndex: '1000',
            padding: '10px', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white',
            borderRadius: '5px', width: '180px', fontSize: '12px'
        });
        phaserContainer.appendChild(hint);
        setTimeout(() => {
            hint.style.opacity = '0.5';
            hint.style.transition = 'opacity 0.5s';
            hint.addEventListener('click', () => hint.style.display = 'none');
        }, 5000);
    }
    
    async printToPDF() {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        
        alert("Generating PDF... This may take a moment.");

        const captureView = async (viewContainer, viewName) => {
            return new Promise(resolve => {
                this.switchView(viewName);
                const originalZoom = this.cameras.main.zoom;
                this.cameras.main.setZoom(1).centerOn(0,0);
                this.deselectArt(); // Hide controls

                setTimeout(() => {
                    this.game.renderer.snapshot(image => {
                         this.cameras.main.setZoom(originalZoom); // Restore
                        resolve(image.src);
                    });
                }, 100);
            });
        };

        const frontImage = await captureView(this.frontContainer, 'front');
        pdf.text("Front View", 10, 10);
        pdf.addImage(frontImage, 'PNG', 10, 20, 180, 180);

        const backImage = await captureView(this.backContainer, 'back');
        pdf.addPage();
        pdf.text("Back View", 10, 10);
        pdf.addImage(backImage, 'PNG', 10, 20, 180, 180);
        
        pdf.save('shirt-mockup.pdf');
        this.switchView('front');
    }
}

// Ensure you have a valid Phaser config
const config = {
    type: Phaser.AUTO,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    parent: 'phaser-container',
    scene: [MockupScene],
    render: {
        preserveDrawingBuffer: true
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

const game = new Phaser.Game(config);