#!/usr/bin/env python3
"""GUI para Claude Code CLI"""

import tkinter as tk
from tkinter import scrolledtext, ttk, messagebox
import subprocess
import threading
import os
import sys
from pathlib import Path

PROJECT_DIR = Path(__file__).parent.resolve()

class ClaudeGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Claude Code GUI")
        self.root.geometry("900x700")
        self.root.minsize(600, 400)
        
        # Variables
        self.model_var = tk.StringVar(value=os.environ.get("OPENAI_MODEL", "anthropic/claude-3-haiku"))
        self.is_running = False
        
        # Estilos
        style = ttk.Style()
        style.configure("TButton", padding=6)
        style.configure("TEntry", padding=4)
        
        # Frame superior: modelo y botón
        top_frame = ttk.Frame(root, padding="10")
        top_frame.pack(fill="x")
        
        ttk.Label(top_frame, text="Modelo:").pack(side="left")
        model_combo = ttk.Combobox(top_frame, textvariable=self.model_var, 
                                    values=[
                                        "anthropic/claude-3-haiku",
                                        "anthropic/claude-3.5-haiku",
                                        "openrouter/free",
                                        "meta-llama/llama-3-8b-instruct",
                                        "google/gemini-2.0-flash-exp",
                                        "mistralai/mistral-7b-instruct",
                                    ],
                                    width=35, state="readonly")
        model_combo.pack(side="left", padx=5)
        
        self.send_btn = ttk.Button(top_frame, text="Enviar", command=self.send_prompt)
        self.send_btn.pack(side="left", padx=5)
        
        clear_btn = ttk.Button(top_frame, text="Limpiar", command=self.clear_output)
        clear_btn.pack(side="left")
        
        # Área de texto principal (scrollable)
        text_frame = ttk.Frame(root)
        text_frame.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        
        self.output = scrolledtext.ScrolledText(
            text_frame, wrap=tk.WORD, font=("Consolas", 11),
            bg="#1e1e1e", fg="#d4d4d4",
            insertbackground="white",
            padx=10, pady=10
        )
        self.output.pack(fill="both", expand=True)
        self.output.tag_configure("system", foreground="#888888")
        self.output.tag_configure("user", foreground="#4ec9b0")
        self.output.tag_configure("assistant", foreground="#dcdcaa")
        self.output.tag_configure("error", foreground="#f44747")
        self.output.tag_configure("tool", foreground="#ce9178")
        
        # Configurar tags clickeables para prompts
        self.output.tag_bind("user", "<Button-1>", self.on_prompt_click)
        self.output.tag_bind("user", "<Enter>", lambda e: self.output.config(cursor="hand2"))
        self.output.tag_bind("user", "<Leave>", lambda e: self.output.config(cursor=""))
        
        # Bind Enter para enviar
        root.bind('<Return>', lambda e: self.send_prompt() if not e.state & 0x1 else None)
        
        # Input box
        input_frame = ttk.Frame(root, padding="10")
        input_frame.pack(fill="x")
        
        self.input_entry = ttk.Entry(input_frame, font=("Consolas", 12))
        self.input_entry.pack(side="left", fill="x", expand=True)
        self.input_entry.focus()
        
        ttk.Button(input_frame, text="▶", command=self.send_prompt, width=3).pack(side="left", padx=(5, 0))
        
        # Inicializar con instrucciones
        self.append_output("system", "Claude Code GUI\n")
        self.append_output("system", "=" * 50 + "\n")
        self.append_output("system", "Escribe tu prompt abajo y presiona Enter o Enviar\n")
        self.append_output("system", "=" * 50 + "\n\n")
        
        self.input_entry.bind('<Return>', lambda e: self.send_prompt())
    
    def append_output(self, tag, text):
        self.output.configure(state="normal")
        self.output.insert("end", text, tag)
        self.output.see("end")
        self.output.configure(state="disabled")
    
    def on_prompt_click(self, event):
        """Al hacer click en un prompt anterior, lo copia al input"""
        index = self.output.index(f"@{event.x},{event.y}")
        line_start = self.output.search("❯", index, backwards=True, stopindex="1.0")
        if line_start:
            line_end = self.output.search("\n", line_start, forwards=True)
            if line_end:
                self.input_entry.delete(0, tk.END)
                # Remover "❯ " del inicio
                content = self.output.get(f"{line_start}+2c", line_end)
                self.input_entry.insert(0, content.strip())
    
    def clear_output(self):
        self.output.configure(state="normal")
        self.output.delete("1.0", "end")
        self.output.configure(state="disabled")
    
    def send_prompt(self):
        if self.is_running:
            return
        
        prompt = self.input_entry.get().strip()
        if not prompt:
            return
        
        # Limpiar input
        self.input_entry.delete(0, tk.END)
        
        # Mostrar prompt del usuario
        self.append_output("user", f"\n❯ {prompt}\n\n")
        
        # Guardar modelo seleccionado
        model = self.model_var.get()
        
        # Ejecutar en thread separado
        self.is_running = True
        self.send_btn.configure(state="disabled", text="Ejecutando...")
        self.root.config(cursor="watch")
        
        thread = threading.Thread(target=self.run_claude, args=(prompt, model), daemon=True)
        thread.start()
    
    def run_claude(self, prompt, model):
        try:
            env = os.environ.copy()
            env["OPENAI_MODEL"] = model
            
            result = subprocess.run(
                ["bun", "run", "start", "-p", prompt],
                cwd=PROJECT_DIR,
                capture_output=True,
                text=True,
                env=env,
                timeout=180
            )
            
            # Filtrar output
            output = result.stdout + result.stderr
            
            # Limpiar escapes ANSI y ruido
            lines = []
            for line in output.split('\n'):
                # Saltar líneas de ruido de terminal
                if any(x in line for x in ['[2J', '[3J', '[H', 'Could not open', 
                                             'Checking npm', 'Auto-updates', 
                                             '✓', '✗', '─', '│', '╭', '╰', '╮', '╯']):
                    continue
                line = line.strip()
                if line:
                    lines.append(line)
            
            clean_output = '\n'.join(lines)
            
            # Mostrar resultado
            if clean_output:
                self.root.after(0, lambda: self.append_output("assistant", clean_output + "\n"))
            else:
                self.root.after(0, lambda: self.append_output("assistant", "(sin respuesta)\n"))
            
            if result.returncode != 0 and not clean_output:
                self.root.after(0, lambda: self.append_output("error", 
                    f"Error: {result.stderr[:200]}\n"))
        
        except subprocess.TimeoutExpired:
            self.root.after(0, lambda: self.append_output("error", "\n⏱ Timeout (2 min)\n"))
        except Exception as e:
            self.root.after(0, lambda: self.append_output("error", f"\n❌ Error: {e}\n"))
        finally:
            self.root.after(0, self.finish_request)
    
    def finish_request(self):
        self.is_running = False
        self.send_btn.configure(state="normal", text="Enviar")
        self.root.config(cursor="")

def main():
    root = tk.Tk()
    app = ClaudeGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()
