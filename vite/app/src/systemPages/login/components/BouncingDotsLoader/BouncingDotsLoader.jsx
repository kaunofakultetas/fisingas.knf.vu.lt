const BouncingDotsLoader = () => {
  return (
    <div className="flex justify-center ml-2.5">
      <div className="w-[5px] h-[5px] m-[1px_2px] rounded-full bg-white animate-bounce-dot translate-y-[5px]"></div>
      <div className="w-[5px] h-[5px] m-[1px_2px] rounded-full bg-white animate-bounce-dot translate-y-[5px] [animation-delay:0.2s]"></div>
      <div className="w-[5px] h-[5px] m-[1px_2px] rounded-full bg-white animate-bounce-dot translate-y-[5px] [animation-delay:0.3s]"></div>
    </div>
  );
};

export default BouncingDotsLoader;
