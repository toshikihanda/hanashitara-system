const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('ハナシタラ.com要件定義.pdf');

pdf(dataBuffer).then(function(data) {
    fs.writeFileSync('parsed_pdf.txt', data.text);
    console.log("PDF parsed successfully.");
}).catch(console.error);
