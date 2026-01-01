<!DOCTYPE html>
<html>
<head>
    <title>Shirt Mockup Designer</title>
    <script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1>Shirt Mockup Designer</h1>
    <div id="app-container">
        <div id="phaser-container"></div>
        <div id="controls">
            <h2>Controls</h2>
            
            <fieldset>
                <legend>View</legend>
                <button id="front-view-btn">Front</button>
                <button id="back-view-btn">Back</button>
            </fieldset>

            <fieldset>
                <legend>Mode</legend>
                <button id="edit-mode-btn" class="active">Edit</button>
                <button id="preview-mode-btn">Preview</button>
            </fieldset>

            <fieldset>
                <legend>Shirt Color</legend>
                <input type="color" id="color-picker" value="#ffffff">
            </fieldset>

            <fieldset id="edit-controls">
                <legend>Upload Artwork</legend>
                <label>Torso Art:</label>
                <input type="file" id="torso-art-upload" accept="image/png, image/jpeg">
                <label>Sleeve Art:</label>
                <input type="file" id="sleeve-art-upload" accept="image/png, image/jpeg">
                
                <div id="art-controls">
                    <p>Click on an artwork on the shirt to select it.</p>
                    <button id="delete-art-btn" disabled>Delete Selected Art</button>
                </div>
            </fieldset>

            <fieldset>
                <legend>Export</legend>
                <button id="print-pdf-btn">Print to PDF</button>
            </fieldset>
        </div>
    </div>
    <script src="main.js"></script>
</body>
</html>