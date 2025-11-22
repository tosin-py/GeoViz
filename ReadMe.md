% --- GeoViz Project Documentation (README) ---
% Designed for clean PDF generation from Markdown content.
\documentclass[11pt, a4paper]{article}
\usepackage[a4paper, top=2.5cm, bottom=2.5cm, left=2.5cm, right=2.5cm]{geometry}
\usepackage{fontspec}
\usepackage{babel} % FIX: Added to support fontspec functions like \babelfont
\usepackage[dvipsnames, usenames, x11names, table]{xcolor} % FIX: Added to support \definecolor and color names (like gray!5)

% Default Font
\babelfont{rm}{Noto Sans}

% Required for lists and links
\usepackage{enumitem}
\usepackage{hyperref}
\hypersetup{
    colorlinks=true,
    linkcolor=blue,
    urlcolor=blue,
    citecolor=blue,
    pdftitle={GeoViz Project Documentation},
    pdfauthor={Oseni Ridwan (oddbrushstudio@gmail.com)}
}

\usepackage{amsmath} % For math environments
\usepackage{listings} % For code blocks

% Setup for Bash code blocks
% FIX: \definecolor and the gray shades now work because xcolor is loaded
\lstset{
    basicstyle=\ttfamily\small,
    breaklines=true,
    frame=single,
    frameround=tttt,
    rulesepcolor=\color{gray!40},
    backgroundcolor=\color{gray!5},
    captionpos=b
}

\definecolor{structurecolor}{rgb}{0.1,0.5,0.2} % Dark green for file structure

\title{\textbf{GeoViz: Geophysical Profile Analyzer}}
\author{Oseni Ridwan | \href{mailto:oddbrushstudio@gmail.com}{oddbrushstudio@gmail.com}}
\date{Version 1.0 (2025)}

\begin{document}

\maketitle
\thispagestyle{empty} % Remove page number from first page

\section*{Short Description}
\noindent GeoViz is a fast, client-side geophysical visualization toolkit. Easily plot VLF and Resistivity survey profiles, automatically calculate Apparent Resistivity ($\rho_a = K \cdot R$), and apply the Karous-Hjelt filter for quick analysis and interpretation. It supports multiple arrays (Wenner, Schlumberger, Dipole-Dipole).

\section*{Key Features}
\begin{itemize}
    \item \textbf{Dual Survey Modes} \textemdash{} Seamlessly switch between Resistivity and VLF plotting modes.
    \item \textbf{Automatic $\rho_a$ Calculation} \textemdash{} Calculates Apparent Resistivity ($\rho_a$) if the column is missing in your input data. Calculated points are visually distinguished on the plot.
    \item \textbf{Geophysical Array Flexibility} \textemdash{} Supports Wenner, Schlumberger, and Dipole-Dipole arrays for correct Geometric Factor ($K$) calculation.
    \item \textbf{Karous-Hjelt Filtering} \textemdash{} Apply a numerical derivative filter to VLF In-Phase data to highlight steeply dipping conductive features.
    \item \textbf{Interactive Visualization} \textemdash{} Customize VLF curve colors and download plots as PNG or JPG images.
    \item \textbf{Robust Data Input} \textemdash{} Accepts direct pasting of CSV/TXT data, handling various delimiters (tabs, commas, spaces).
\end{itemize}

\section*{Getting Started}
\noindent Since GeoViz is a pure HTML/CSS/JavaScript application, it requires no installation or server dependencies.

\subsection*{1. Running the Application}
\noindent Clone the repository and open the main HTML file:
\begin{lstlisting}[language=bash]
git clone https://github.com/oddbrushstudio/geoviz.git
cd geoviz
open index.html
\end{lstlisting}

\section*{Data Formats}
\noindent You can paste data directly into the text area. The app accepts tabs, commas, or spaces as delimiters.

\subsection*{A. Resistivity Survey}
\noindent Select your Array Type. The input expects the following columns (7 columns total):
\begin{itemize}[noitemsep, label=-]
    \item P1, P2, P3, P4 (Electrode Positions)
    \item K (Geometric Factor)
    \item R (Measured Resistance)
    \item Apparent\_Rho (Optional - calculated if missing)
\end{itemize}
\noindent \textbf{Example Data Row (Wenner):}
\begin{verbatim}
0    10    20    30    62.83    8.1    508.92
\end{verbatim}

\subsection*{B. VLF Survey}
\noindent Three columns expected:
\begin{itemize}[noitemsep, label=-]
    \item Station (m)
    \item InPhase ($\%$)
    \item Quadrature ($\%$)
\end{itemize}
\noindent \textbf{Example Data Row:}
\begin{verbatim}
0    45.2    -12.5
\end{verbatim}

\section*{Project Structure}
\noindent The repository contains the following files:
\begin{itemize}[noitemsep, label=\color{structurecolor}$\rightarrow$]
    \item \texttt{index.html} \textemdash{} Application UI (Structure)
    \item \texttt{styles.css} \textemdash{} Styling (Presentation)
    \item \texttt{script.js} \textemdash{} Core logic and calculations (Behavior)
    \item \texttt{LICENSE} \textemdash{} MIT License
    \item \texttt{.gitignore} \textemdash{} Git exclusion file
\end{itemize}

\end{document}
