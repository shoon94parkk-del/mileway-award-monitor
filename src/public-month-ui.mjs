import {hasModernAirportUi} from './public-ui.mjs';

// Selects a departure month through the currently visible official airline UI.
// Legacy monthCalendarPopup and modern kds-dateinput_1 expose the same operation.
export async function selectPublicMonth(page,month){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Invalid public departure month');
  const [year,number]=month.split('-').map(Number);
  if(await hasModernAirportUi(page)){
    await page.locator('kds-dateinput_1 button.ui-booking-tool__button').click();
    const dialog=page.getByRole('dialog',{name:'탑승월 선택'});
    await dialog.getByRole('group',{name:String(year),exact:true}).getByRole('button',{name:number+'월',exact:true}).click();
    await dialog.getByRole('button',{name:'선택',exact:true}).click();
    return 'modern';
  }
  await page.locator('#seatCalendarBtn').click();
  const baseYear=Number((await page.locator('#monthCalendarPopup').innerText()).match(/20\d{2}/)?.[0]);
  if(!Number.isFinite(baseYear))throw Error('Month calendar base year missing');
  await page.locator('#monthCalendarPopup [id="'+((year-baseYear)*12+number-1)+'"]').click();
  await page.getByRole('button',{name:'선택',exact:true}).click();
  return 'legacy';
}
