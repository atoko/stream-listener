import Admzip from "adm-zip"

const zip = new Admzip();
zip.addLocalFolder('out/plugins', 'plugins');
zip.writeZip("out/plugins.zip");
