// -----------------------------------------------------------
//  [*] Login page — BouncingDotsLoader
//
//  Three small white dots bouncing in sequence — the loading
//  indicator inside the "PALAUKITE" login button. The
//  animation (animate-bounce-dot) is defined in globals.css.
//
//  Used by:
//    - Login — the login form's submit button while the
//      request is running
// -----------------------------------------------------------

export default function BouncingDotsLoader() {
  return (
    <div className="flex justify-center ml-2.5">
      <div className="w-[5px] h-[5px] m-[1px_2px] rounded-full bg-white animate-bounce-dot translate-y-[5px]"></div>
      <div className="w-[5px] h-[5px] m-[1px_2px] rounded-full bg-white animate-bounce-dot translate-y-[5px] [animation-delay:0.2s]"></div>
      <div className="w-[5px] h-[5px] m-[1px_2px] rounded-full bg-white animate-bounce-dot translate-y-[5px] [animation-delay:0.3s]"></div>
    </div>
  );
}
