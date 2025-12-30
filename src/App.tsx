function App() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-numa-bg text-numa-text">
      {/* Cercle qui pulse */}
      <div className="w-24 h-24 bg-numa-primary rounded-full blur-xl opacity-20 animate-pulse absolute"></div>
      
      <h1 className="text-5xl font-thin tracking-[0.2em] z-10">
        NUMA
      </h1>
      
      <p className="mt-6 text-numa-primary/60 font-mono text-xs uppercase tracking-widest z-10">
        Système Neural Sécurisé
      </p>
    </div>
  );
}

export default App;