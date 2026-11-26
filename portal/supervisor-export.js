(function () {
  'use strict';

  const encoder = new TextEncoder();
  const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  function xml(value) {
    return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
      .replace(/[<>&"]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[char]);
  }
  function column(index) {
    let value = index + 1;
    let result = '';
    while (value) {
      value--;
      result = String.fromCharCode(65 + value % 26) + result;
      value = Math.floor(value / 26);
    }
    return result;
  }
  function sheet(rows) {
    const body = rows.map((row, index) => {
      const position = index + 1;
      return '<row r="' + position + '">' + row.map((value, field) => {
        const cell = column(field) + position;
        if (typeof value === 'number' && Number.isFinite(value)) return '<c r="' + cell + '"><v>' + value + '</v></c>';
        return '<c r="' + cell + '" t="inlineStr"><is><t xml:space="preserve">' + xml(value) + '</t></is></c>';
      }).join('') + '</row>';
    }).join('');
    return '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews><sheetData>' + body + '</sheetData></worksheet>';
  }
  function crc32(data) {
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  // Open XML uses a ZIP container. Store the five workbook parts without compression.
  function zip(files) {
    const parts = [];
    const directory = [];
    let offset = 0;
    let directorySize = 0;
    for (const [name, contents] of Object.entries(files)) {
      const filename = encoder.encode(name);
      const data = encoder.encode(contents);
      const checksum = crc32(data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(12, 33, true);
      local.setUint32(14, checksum, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, filename.length, true);
      parts.push(local.buffer, filename, data);

      const central = new DataView(new ArrayBuffer(46));
      central.setUint32(0, 0x02014b50, true);
      central.setUint16(4, 20, true);
      central.setUint16(6, 20, true);
      central.setUint16(14, 33, true);
      central.setUint32(16, checksum, true);
      central.setUint32(20, data.length, true);
      central.setUint32(24, data.length, true);
      central.setUint16(28, filename.length, true);
      central.setUint32(42, offset, true);
      directory.push(central.buffer, filename);
      directorySize += central.byteLength + filename.length;
      offset += local.byteLength + filename.length + data.length;
    }

    const end = new DataView(new ArrayBuffer(22));
    const count = Object.keys(files).length;
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, count, true);
    end.setUint16(10, count, true);
    end.setUint32(12, directorySize, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...directory, end.buffer], { type: mime });
  }
  function excel(output, filename) {
    const pack = 'http://schemas.openxmlformats.org/package/2006';
    const office = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const formats = 'application/vnd.openxmlformats-officedocument.spreadsheetml';
    const blob = zip({
      '[Content_Types].xml': '<Types xmlns="' + pack + '/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="' + formats +
        '.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="' + formats + '.worksheet+xml"/></Types>',
      '_rels/.rels': '<Relationships xmlns="' + pack + '/relationships"><Relationship Id="rId1" Type="' +
        office + '/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="' +
        office + '"><bookViews><workbookView/></bookViews><sheets><sheet name="تقرير عزم" sheetId="1" r:id="rId1"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels': '<Relationships xmlns="' + pack + '/relationships"><Relationship Id="rId1" Type="' +
        office + '/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
      'xl/worksheets/sheet1.xml': sheet([output.columns, ...output.rows])
    });
    const address = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = address;
    link.download = filename + '.xlsx';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(address), 60_000);
  }
  function print(title, period, safeTable) {
    const area = document.createElement('section');
    area.className = 'super-print';
    area.dir = 'rtl';
    const heading = document.createElement('h1');
    heading.textContent = 'أكاديمية عزم · ' + title;
    const date = document.createElement('p');
    date.textContent = period;
    area.append(heading, date);
    area.insertAdjacentHTML('beforeend', safeTable);
    document.body.append(area);
    document.body.classList.add('super-printing');
    const cleanup = () => {
      area.remove();
      document.body.classList.remove('super-printing');
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    try { window.print(); }
    catch (error) { cleanup(); throw error; }
  }

  window.AZM_SUPERVISOR_EXPORT = { excel, print };
})();
