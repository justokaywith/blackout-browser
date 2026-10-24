async function launchInstaller(file,{fs,shell,quit}) {
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())throw Error('The downloaded installer is missing. Download the update again.');
  const error=await shell.openPath(file);
  if(error)throw Error(error);
  quit();
  return true;
}
module.exports={launchInstaller};
