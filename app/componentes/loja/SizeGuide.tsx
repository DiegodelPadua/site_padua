"use client";

/* =========================================================
   GUIA DE MEDIDAS - PÁDUA
   =========================================================
   Este componente cria a janela do Guia de Medidas.

   Ele será utilizado por todas as páginas de camisetas,
   evitando repetir a mesma estrutura em cada produto.
   ========================================================= */

type SizeGuideProps = {
  isOpen: boolean;
  onClose: () => void;
};


export default function SizeGuide({
  isOpen,
  onClose,
}: SizeGuideProps) {

  /* =======================================================
     SE O GUIA ESTIVER FECHADO
     =======================================================
     Não renderiza nada na página.
     ======================================================= */

  if (!isOpen) {
    return null;
  }


  return (

    /* =====================================================
       FUNDO ESCURO
       =====================================================
       Clicar fora da janela também fecha o Guia.
       ===================================================== */

    <div
      className="sizeGuideOverlay"
      onClick={onClose}
    >

      {/* ===================================================
          JANELA DO GUIA
          ===================================================
          stopPropagation impede que clicar dentro da
          janela feche o Guia.
          =================================================== */}

      <div
        className="sizeGuideModal"
        onClick={(event) => event.stopPropagation()}
      >

        {/* ===============================================
            CABEÇALHO
            =============================================== */}

        <div className="sizeGuideHeader">

          <div>

            <span>
              PÁDUA — GUIA DE MEDIDAS
            </span>

            <h2>
              ENCONTRE SEU TAMANHO
            </h2>

          </div>


          {/* Botão para fechar */}

          <button
            type="button"
            className="sizeGuideClose"
            onClick={onClose}
            aria-label="Fechar guia de medidas"
          >
            ×
          </button>

        </div>


        {/* ===============================================
            ORIENTAÇÃO
            =============================================== */}

        <p className="sizeGuideDescription">
          Compare as medidas abaixo com uma camiseta
          que tenha um caimento que você goste.
        </p>


        {/* ===============================================
            TABELA DE MEDIDAS
            =============================================== */}

        <div className="sizeGuideTableWrapper">

          <table className="sizeGuideTable">

            <thead>

              <tr>
                <th>TAMANHO</th>
                <th>LARGURA</th>
                <th>COMPRIMENTO</th>
                <th>MANGA</th>
              </tr>

            </thead>


            <tbody>

              <tr>
                <td>P</td>
                <td>— cm</td>
                <td>— cm</td>
                <td>— cm</td>
              </tr>

              <tr>
                <td>M</td>
                <td>— cm</td>
                <td>— cm</td>
                <td>— cm</td>
              </tr>

              <tr>
                <td>G</td>
                <td>— cm</td>
                <td>— cm</td>
                <td>— cm</td>
              </tr>

              <tr>
                <td>GG</td>
                <td>— cm</td>
                <td>— cm</td>
                <td>— cm</td>
              </tr>

            </tbody>

          </table>

        </div>


        {/* ===============================================
            OBSERVAÇÃO
            =============================================== */}

        <p className="sizeGuideNote">
          As medidas podem apresentar pequenas variações
          devido ao processo de produção.
        </p>

      </div>

    </div>
  );
}