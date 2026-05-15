import { ColorSwatch, Group } from '@mantine/core';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Draggable from 'react-draggable';
import { SWATCHES } from '@/constants';

interface GeneratedResult {
  expression: string;
  answer: string;
}

interface Response {
  expr: string;
  result: string;
  assign: boolean;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [penEnabled, setPenEnabled] = useState(true);
  const [color, setColor] = useState('rgb(255, 255, 255)');
  const [reset, setReset] = useState(false);
  const [dictOfVars, setDictOfVars] = useState({});
  const [result, setResult] = useState<GeneratedResult>();
  const [latexPosition, setLatexPosition] = useState({ x: 10, y: 200 });
  const [latexExpression, setLatexExpression] = useState<Array<string>>([]);
  const [lastPanPosition, setLastPanPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isRunning, setIsRunning] = useState(false); // ✅ NEW: Running indicator

  // Load MathJax
  useEffect(() => {
    const script = document.createElement('script');
    script.src =
      'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-MML-AM_CHTML';
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => {
      window.MathJax.Hub.Config({
        tex2jax: { inlineMath: [['$', '$'], ['\\(', '\\)']] },
      });
    };

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (latexExpression.length > 0 && window.MathJax) {
      setTimeout(() => {
        window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub]);
      }, 0);
    }
  }, [latexExpression]);

  useEffect(() => {
    if (result) renderLatexToCanvas(result.expression, result.answer);
  }, [result]);

  useEffect(() => {
    if (reset) {
      resetCanvas();
      setLatexExpression([]);
      setResult(undefined);
      setDictOfVars({});
      setReset(false);
    }
  }, [reset]);

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = color;
      }
    }
  }, []);

  const renderLatexToCanvas = (expression: string, answer: string) => {
    const formattedExpr = expression;
    const formattedAnswer = answer.toString();
    const latex = `\\(\\LARGE{\\text{${formattedExpr}}\\,=\\,${formattedAnswer}}\\)`;
    setLatexExpression([...latexExpression, latex]);
  };

  const resetCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  // --- Drawing ---
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!penEnabled) return;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
        setIsDrawing(true);
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !penEnabled) return;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        ctx.strokeStyle = color;
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => setIsDrawing(false);

  // --- Smooth & Fast 2D Panning ---
  const startPan = (e: React.MouseEvent<HTMLDivElement>) => {
    if (penEnabled) return; // only pan when pen is off
    setIsPanning(true);
    setLastPanPosition({ x: e.clientX, y: e.clientY });
  };

  const doPan = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning || penEnabled) return;
    const container = containerRef.current;
    if (container) {
      const speed = 2.0; // faster scroll
      const dx = (e.clientX - lastPanPosition.x) * speed;
      const dy = (e.clientY - lastPanPosition.y) * speed;
      container.scrollLeft -= dx;
      container.scrollTop -= dy;
      setLastPanPosition({ x: e.clientX, y: e.clientY });
    }
  };

  const stopPan = () => setIsPanning(false);

  // --- Send visible part to backend ---
  const runRoute = async () => {
    if (isRunning) return; // prevent duplicate clicks
    setIsRunning(true); // ✅ show "Running..."

    try {
      const canvas = canvasRef.current;
      const container = containerRef.current;

      if (canvas && container) {
        const ctx = canvas.getContext('2d');
        const scrollX = container.scrollLeft;
        const scrollY = container.scrollTop;
        const visibleWidth = container.clientWidth;
        const visibleHeight = container.clientHeight;

        const visibleCanvas = document.createElement('canvas');
        visibleCanvas.width = visibleWidth;
        visibleCanvas.height = visibleHeight;

        const visibleCtx = visibleCanvas.getContext('2d');
        if (visibleCtx && ctx) {
          visibleCtx.drawImage(
            canvas,
            scrollX,
            scrollY,
            visibleWidth,
            visibleHeight,
            0,
            0,
            visibleWidth,
            visibleHeight
          );
        }

        const croppedImage = visibleCanvas.toDataURL('image/png');

        const response = await axios.post(`${import.meta.env.VITE_API_URL}/calculate`, {
          image: croppedImage,
          dict_of_vars: dictOfVars,
        });

        const resp = await response.data;
        console.log('Response', resp);

        resp.data.forEach((data: Response) => {
          if (data.assign === true) {
            setDictOfVars({
              ...dictOfVars,
              [data.expr]: data.result,
            });
          }
        });

        const centerX = scrollX + visibleWidth / 2;
        const centerY = scrollY + visibleHeight / 2;
        setLatexPosition({ x: centerX, y: centerY });

        resp.data.forEach((data: Response) => {
          setTimeout(() => {
            setResult({
              expression: data.expr,
              answer: data.result,
            });
          }, 1000);
        });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsRunning(false); // ✅ revert to "Run" after completion
    }
  };

  return (
    <>
      {/* Toolbar */}
      <div className="fixed top-2 left-0 right-0 z-20 grid grid-cols-4 gap-2 px-4">
        <Button
          onClick={() => setReset(true)}
          className="bg-black text-white border border-white/30 hover:bg-gray-900"
        >
          Reset
        </Button>

        <Group className="flex justify-center">
          {SWATCHES.map((swatch) => (
            <ColorSwatch
              key={swatch}
              color={swatch}
              onClick={() => setColor(swatch)}
              style={{ cursor: 'pointer' }}
            />
          ))}
        </Group>

        <Button
          onClick={() => setPenEnabled(!penEnabled)}
          className={`text-white border border-white/30 ${
            penEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-800'
          }`}
        >
          {penEnabled ? 'Pen: ON ✏️' : 'Pan Mode 🖐️'}
        </Button>

        <Button
          onClick={runRoute}
          disabled={isRunning}
          className={`border border-white/30 text-white ${
            isRunning
              ? 'bg-yellow-600 cursor-not-allowed'
              : 'bg-black hover:bg-gray-900'
          }`}
        >
          {isRunning ? 'Running… ⏳' : 'Run'}
        </Button>
      </div>

      {/* Infinite scrollable black canvas */}
      <div
        ref={containerRef}
        id="canvas-container"
        className="relative overflow-scroll w-screen h-screen bg-black"
        onMouseDown={startPan}
        onMouseMove={doPan}
        onMouseUp={stopPan}
        onMouseLeave={stopPan}
        style={{
          scrollBehavior: 'auto',
          cursor: penEnabled ? 'crosshair' : isPanning ? 'grabbing' : 'grab',
        }}
      >
        <canvas
          ref={canvasRef}
          id="canvas"
          width={5000}
          height={5000}
          className="bg-black absolute top-0 left-0"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
        />

        {latexExpression &&
          latexExpression.map((latex, index) => (
            <Draggable
              key={index}
              defaultPosition={latexPosition}
              bounds="parent"
              onStop={(_, data) => setLatexPosition({ x: data.x, y: data.y })}
            >
              <div
                className="
                  absolute 
                  p-4 
                  bg-black/80 
                  backdrop-blur-xl 
                  rounded-2xl 
                  border border-white/30 
                  shadow-2xl 
                  overflow-auto
                  max-w-[70vw]
                  max-h-[30vh]
                  z-10
                "
              >
                <div
                  className="
                    latex-content 
                    text-white 
                    text-lg 
                    leading-relaxed 
                    tracking-wide 
                    whitespace-normal 
                    break-words 
                    overflow-y-auto 
                    scrollbar-thin 
                    scrollbar-thumb-gray-600 
                    scrollbar-track-transparent
                  "
                >
                  {latex}
                </div>
              </div>
            </Draggable>
          ))}
      </div>
    </>
  );
}
