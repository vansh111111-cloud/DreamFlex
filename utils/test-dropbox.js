const { Dropbox } = require("dropbox");
const fs = require("fs");
require("isomorphic-fetch");

const ACCESS_TOKEN = "sl.u.AF9VA-KAbG_BNpsXY_4M8BDk2wA7qyFWVfERc6q2KSSIwxHSMaIR4P_6BQQnWS-oAjgnc2aSOCYL6ASIgwCqE-Q0mGSRNY3xo8irtpOFK_ozjQxDYzzZBrXOGwLOrvbF09LmK_6yGk0mWhPN4heIQlVHltX1R5iV7VZaKHxVAyUdYiTfPo9-PGG4g6BaEb9V0iIfv3AdiwmT63c4MVD2XFckkTV7wFnlHJd7aIktDb7WsL0yGEUeTBgy8HTsUdg1Q157a5e0gnV9NEiPMuv1Fj0h3awzQp29hMaFbEad6aeRFB5D7_SaU1Beq_Gb3ThCYoo_Kt1DAsE5T0HzeUaBnmTAj6tajirMpbl-vPGDUoIsjFUMI-fxdYbOgPiVaqAziS-1r10SPSphM3BItm3WF3mW2IPdX2A4bcfXnOmtDIXDakyEIOwvS9IsoaacO9o-dvsGt_nd2A0LXCPA88dC0Wm13fgjH64prlCEVyQFA36GuO5T35i6qThPckcde0awC4IVibU2yWyOWciGDRAFpxKS3B5o27F_G4Y5u7ensnCXV6wnZloYaQa3aFvKSvCCEkqbJVC4m1L2chisqWi_naO4iw6_hxs_3hB6ZiX69vfvAI_wajudAnsHdMFF5qUPuIK84ejtr--g_FedHsTp7ehf2N3iBwoJNqiUHdFk93FCMRrhphU1gFZVkAA5MVhT4uZEu-ffD_mALOKlxHz52x0_uejdJFC_V7tb6gJX0TfKCr-N-KA3K5a1xha7Rn2_aL7e7_JojF6_j2ATXu6XKuIdP-PjIwQys5NggU3hzKUWfkyErRqotSI5kkzwVFq9eRnwfRwa053Cl3GsdR0D_uf-a6RqGXc_1UKIz00aaa6qdhjTXgl6P7TWWu3QwD-y59GYEMb4Z72B1YwvoZVf9ns9X8oJZQVh3NLpLpk-wb1WC6_YvyiV3NM0t9JqxMyAZdP8c7Dbz4QlqKNlu5jlWkY9fj4LOXqFL5TJ5lHcgd1CtiWLJSdYJ8sP2srlJhJT9JpcWPS83ylsDg5wqzT4f5Pd13zt3QT49xpY8HsC3g8o_D2qXniYbYbTkh3MU7urJUApAYIwovH45lmdFTlp-9kDglM2IQRAakkuF3w0JQAq5Ku-jw6HRms2m2DNn5kMpQ8gbRy3zD1kWdCdRfrqkMifEgNlnu5E1tI-YzvPiRubxdVB3-ZauKLjcjxRLvUD6TYkx7N2PUUfmYR4Hb8CvqLetmUCnr5lQ3sjMkxdU6n4Rg3rBjEafwuuMLY7VnFsNM_447iTvJKr3z27Bi0x_JFATZqA8p79kM88VIXS8n58vchQI9KFNDRGfprKWX975elqkHvZeGLiTeD8sJjOo7xrfzBQBhFUGlWxbUWGW1ZZLwyQKAHDzym83BHPRO95xjruBLkC4rtkAaLYV_5Y9ZY45iB_Z7eitx1uDF4TVfJY_Hq6FrsvGwjCvzJOF7Uq3Dk"; // 🔑 replace with your token

const dbx = new Dropbox({ accessToken: ACCESS_TOKEN });

(async () => {
  try {
    // Pick a tiny test file
    const filePath = "./test.txt";
    fs.writeFileSync(filePath, "Hello Dropbox test!"); // create a small test file

    const contents = fs.readFileSync(filePath);

    console.log("Uploading test.txt ...");
    const response = await dbx.filesUpload({
      path: "/test.txt",
      contents,
    });

    console.log("✅ Upload success:", response.result);
  } catch (err) {
    console.error("❌ Upload failed:", err);
  }
})();
